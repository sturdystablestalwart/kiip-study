const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { scoreQuestion } = require('../utils/scoring');

// --- Rate Limiting (10 requests per minute) ---
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { message: 'Too many requests. Please wait a minute before trying again.' },
    standardHeaders: true,
    legacyHeaders: false
});

// --- GEMINI AI Integration ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseTextWithLLM = async (text) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        You are an expert KIIP (Korea Immigration and Integration Program) Level 2 instructor.
        Your task is to parse the following text and convert it into a structured practice test.
        The text might be raw study material or an existing mock test.

        REQUIREMENTS:
        1. Generate exactly 20 questions if possible.
        2. Questions must be multiple-choice with 4 options each.
        3. Include a helpful explanation for each answer IN ENGLISH.
        4. If the text mentions images like "[Image 1]" or "q1.jpg", include the filename in the "image" field.
        5. Point spread: Vocabulary/Grammar (Questions 1-10) are usually 4 points each, Reading (11-20) are 6 points each (or adjust to fit KIIP standard total of 100).
        6. The output MUST be a valid JSON object matching this structure:
        {
          "title": "A descriptive title for the test",
          "questions": [
            {
              "text": "The question text (in Korean)",
              "options": [
                { "text": "Option 1", "isCorrect": false },
                { "text": "Option 2", "isCorrect": true },
                { "text": "Option 3", "isCorrect": false },
                { "text": "Option 4", "isCorrect": false }
              ],
              "explanation": "Why the correct answer is right (IN ENGLISH)",
              "type": "multiple-choice",
              "image": "optional_filename.jpg"
            }
          ]
        }

        TEXT TO PARSE:
        ${text}

        Respond ONLY with the JSON object.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);

        // Validate that we have at least 1 question
        if (!parsed.questions || parsed.questions.length === 0) {
            throw new Error('AI generated no valid questions. Please provide more content.');
        }

        return parsed;
    } catch (err) {
        console.error("LLM Parsing Error:", err);
        throw new Error("Failed to parse text with AI: " + err.message);
    }
};

// --- Multer Setup for Documents (PDF, DOCX, TXT, MD) ---
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/documents');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});

const documentFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOCX, TXT, and MD files are allowed'), false);
    }
};

const documentUpload = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1
    }
});

// --- Multer Setup for Images ---
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/images');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

const imageFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, GIF, WebP, BMP, and TIFF images are allowed'), false);
    }
};

const imageUpload = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per image
        files: 20 // Max 20 images
    }
});

// --- Validation Middleware ---
const validateTextGeneration = [
    body('text')
        .trim()
        .isLength({ min: 200 })
        .withMessage('Text must be at least 200 characters long')
        .isLength({ max: 50000 })
        .withMessage('Text must not exceed 50,000 characters')
];

// ============================================
// ROUTES
// ============================================

// GET all tests with last attempt (aggregation + cursor pagination + search)
router.get('/', async (req, res) => {
    try {
        const { q, level, unit, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        // Build match stage
        const match = {};
        if (q && q.trim()) {
            match.$text = { $search: q.trim() };
        }
        if (level) match.level = level;
        if (unit) match.unit = unit;

        // Cursor pagination: fetch items older than cursor
        if (cursor) {
            if (mongoose.Types.ObjectId.isValid(cursor)) {
                match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
            }
        }

        // Build aggregation pipeline
        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: limit + 1 },
            // Exclude questions array from list response (save bandwidth)
            { $project: {
                title: 1, category: 1, description: 1, level: 1, unit: 1,
                createdAt: 1, questionCount: { $size: '$questions' }
            }},
            // Join last attempt per test
            { $lookup: {
                from: 'attempts',
                let: { testId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$testId', '$$testId'] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 },
                    { $project: { score: 1, totalQuestions: 1, mode: 1, createdAt: 1 } }
                ],
                as: 'attempts'
            }},
            { $addFields: {
                lastAttempt: { $arrayElemAt: ['$attempts', 0] }
            }},
            { $project: { attempts: 0 } }
        ];

        const results = await Test.aggregate(pipeline);

        // Determine if there are more results
        const hasMore = results.length > limit;
        const tests = hasMore ? results.slice(0, limit) : results;
        const nextCursor = hasMore ? tests[tests.length - 1]._id : null;

        // Get total count (without cursor filter)
        const countMatch = { ...match };
        delete countMatch._id;
        const countResult = await Test.aggregate([
            { $match: countMatch },
            { $count: 'total' }
        ]);
        const total = countResult[0]?.total || 0;

        res.json({ tests, nextCursor, total });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch tests: ' + err.message });
    }
});

// GET recent attempts for dashboard
router.get('/recent-attempts', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const attempts = await Attempt.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Attach test title to each attempt (skip null testIds from endless mode)
        const testIds = [...new Set(
            attempts.filter(a => a.testId).map(a => a.testId.toString())
        )];
        const tests = await Test.find(
            { _id: { $in: testIds } },
            { title: 1, level: 1, unit: 1 }
        ).lean();
        const testMap = Object.fromEntries(tests.map(t => [t._id.toString(), t]));

        const enriched = attempts.map(a => ({
            ...a,
            test: a.testId
                ? (testMap[a.testId.toString()] || { title: 'Deleted test' })
                : { title: 'Endless Mode' }
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch recent attempts: ' + err.message });
    }
});

// GET random questions for endless mode
router.get('/endless', async (req, res) => {
    try {
        const { level, unit, exclude, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 20);

        // Parse excluded question identifiers (format: "testId:qIdx,testId:qIdx")
        const excludeSet = new Set((exclude || '').split(',').filter(Boolean));

        // Build match for tests
        const match = {};
        if (level) match.level = level;
        if (unit) match.unit = unit;

        // Fetch matching tests with their questions
        const tests = await Test.find(match, { questions: 1, title: 1 }).lean();

        // Flatten all questions with source references
        let pool = [];
        for (const test of tests) {
            for (let i = 0; i < test.questions.length; i++) {
                const key = `${test._id}:${i}`;
                if (!excludeSet.has(key)) {
                    pool.push({
                        ...test.questions[i],
                        _sourceTestId: test._id,
                        _sourceIndex: i,
                        _sourceKey: key
                    });
                }
            }
        }

        // Shuffle and pick `limit` questions (Fisher-Yates)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const selected = pool.slice(0, limit);

        res.json({
            questions: selected,
            remaining: pool.length - selected.length
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch endless questions: ' + err.message });
    }
});

// POST save endless mode chunk attempt
router.post('/endless/attempt', async (req, res) => {
    try {
        const { answers, duration, sourceQuestions } = req.body;
        if (!answers || !answers.length) {
            return res.status(400).json({ message: 'No answers provided' });
        }

        let score = 0;
        const verifiedAnswers = answers.map(ans => {
            if (ans.isCorrect) score++;
            return ans;
        });

        const attempt = new Attempt({
            testId: null,
            score,
            totalQuestions: answers.length,
            duration: duration || 0,
            overdueTime: 0,
            answers: verifiedAnswers,
            sourceQuestions: sourceQuestions || [],
            mode: 'Endless'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: 'Failed to save endless attempt: ' + err.message });
    }
});

// GET specific test
router.get('/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });
        res.json(test);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch test: ' + err.message });
    }
});

// POST generate test from text (NEW ENDPOINT)
router.post('/generate', apiLimiter, validateTextGeneration, async (req, res) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array().map(e => e.msg).join('. ')
        });
    }

    try {
        const { text } = req.body;

        const data = await parseTextWithLLM(text);

        // Validate AI response has questions
        if (!data.questions || data.questions.length === 0) {
            return res.status(400).json({
                message: 'AI could not generate any questions from the provided text. Please provide more detailed content.'
            });
        }

        const newTest = new Test({
            title: data.title || 'Generated Test',
            questions: data.questions,
            category: 'Text Input'
        });

        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (err) {
        console.error("Text Generation Error:", err);
        res.status(400).json({ message: err.message });
    }
});

// POST upload image (NEW ENDPOINT)
router.post('/upload', imageUpload.single('image'), (req, res) => {
    if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
    }

    res.json({
        imageUrl: '/uploads/images/' + req.file.filename,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
});

// POST upload multiple images
router.post('/upload-multiple', imageUpload.array('images', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No image files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
        imageUrl: '/uploads/images/' + file.filename,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
    }));

    res.json({ images: uploadedFiles });
});

// POST generate from file (updated with better error handling)
router.post('/generate-from-file', apiLimiter, documentUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded' });
    }

    let text = '';
    const filePath = req.file.path;

    try {
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            text = data.text;
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else {
            text = fs.readFileSync(filePath, 'utf-8');
        }

        // Validate text length
        if (text.trim().length < 200) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'Document contains less than 200 characters of text. Please upload a document with more content.'
            });
        }

        if (text.length > 50000) {
            text = text.substring(0, 50000);
        }

        const data = await parseTextWithLLM(text);

        // Validate AI response
        if (!data.questions || data.questions.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'AI could not generate any questions from the document. Please try a different document.'
            });
        }

        const newTest = new Test({
            title: data.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
            questions: data.questions,
            category: 'File Upload'
        });
        const savedTest = await newTest.save();

        // Clean up temp file
        fs.unlinkSync(filePath);

        res.status(201).json(savedTest);
    } catch (err) {
        // Clean up temp file on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error("File Generation Error:", err);
        res.status(400).json({ message: 'Failed to process document: ' + err.message });
    }
});

// POST save attempt (server-side score verification)
router.post('/:id/attempt', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Server-side score verification
        let serverScore = 0;
        const verifiedAnswers = (req.body.answers || []).map((ans, idx) => {
            const question = test.questions[idx];
            if (!question) return { ...ans, isCorrect: false };
            const isCorrect = scoreQuestion(question, ans);
            if (isCorrect) serverScore++;
            return { ...ans, isCorrect };
        });

        const attempt = new Attempt({
            testId: req.params.id,
            score: serverScore,
            totalQuestions: test.questions.length,
            duration: req.body.duration,
            overdueTime: req.body.overdueTime || 0,
            answers: verifiedAnswers,
            mode: req.body.mode || 'Test'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: 'Failed to save attempt: ' + err.message });
    }
});

// DELETE test (NEW ENDPOINT)
router.delete('/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Delete associated attempts
        await Attempt.deleteMany({ testId: req.params.id });

        // Delete the test
        await Test.findByIdAndDelete(req.params.id);

        res.json({ message: 'Test deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete test: ' + err.message });
    }
});

// Error handling middleware for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files. Maximum is 20 images.' });
        }
        return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
});

module.exports = { router, parseTextWithLLM };
