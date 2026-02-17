const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const Flag = require('../models/Flag');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseTextWithLLM } = require('../utils/llm');

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// --- Rate Limiting (10 requests per minute) ---
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: 'Too many requests. Please wait a minute before trying again.' },
    standardHeaders: true,
    legacyHeaders: false
});

// --- Multer Setup for Documents ---
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
    limits: { fileSize: 10 * 1024 * 1024, files: 1 }
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
        'image/jpeg', 'image/png', 'image/gif',
        'image/webp', 'image/bmp', 'image/tiff'
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
    limits: { fileSize: 10 * 1024 * 1024, files: 20 }
});

// --- Validation ---
const validateTextGeneration = [
    body('text')
        .trim()
        .isLength({ min: 200 })
        .withMessage('Text must be at least 200 characters long')
        .isLength({ max: 50000 })
        .withMessage('Text must not exceed 50,000 characters')
];

// ============================================
// ADMIN ROUTES
// ============================================

// POST /api/admin/tests/generate
router.post('/tests/generate', apiLimiter, validateTextGeneration, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array().map(e => e.msg).join('. ')
        });
    }

    try {
        const { text } = req.body;
        const data = await parseTextWithLLM(text);

        if (!data.questions || data.questions.length === 0) {
            return res.status(400).json({
                message: 'AI could not generate any questions from the provided text.'
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

// POST /api/admin/tests/upload
router.post('/tests/upload', imageUpload.single('image'), (req, res) => {
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

// POST /api/admin/tests/upload-multiple
router.post('/tests/upload-multiple', imageUpload.array('images', 20), (req, res) => {
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

// POST /api/admin/tests/generate-from-file
router.post('/tests/generate-from-file', apiLimiter, documentUpload.single('file'), async (req, res) => {
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

        if (text.trim().length < 200) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'Document contains less than 200 characters of text.'
            });
        }

        if (text.length > 50000) {
            text = text.substring(0, 50000);
        }

        const data = await parseTextWithLLM(text);

        if (!data.questions || data.questions.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'AI could not generate any questions from the document.'
            });
        }

        const newTest = new Test({
            title: data.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
            questions: data.questions,
            category: 'File Upload'
        });
        const savedTest = await newTest.save();
        fs.unlinkSync(filePath);
        res.status(201).json(savedTest);
    } catch (err) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error("File Generation Error:", err);
        res.status(400).json({ message: 'Failed to process document: ' + err.message });
    }
});

// POST /api/admin/tests/import
router.post('/tests/import', async (req, res) => {
    try {
        const { title, category, description, level, unit, questions } = req.body;

        if (!title || !questions || !questions.length) {
            return res.status(400).json({ message: 'Title and at least one question are required' });
        }

        const newTest = new Test({
            title,
            category: category || 'Import',
            description,
            level,
            unit,
            questions
        });

        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (err) {
        res.status(400).json({ message: 'Failed to import test: ' + err.message });
    }
});

// PATCH /api/admin/tests/:id
router.patch('/tests/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const { title, category, description, level, unit, questions } = req.body;
        if (title !== undefined) test.title = title;
        if (category !== undefined) test.category = category;
        if (description !== undefined) test.description = description;
        if (level !== undefined) test.level = level;
        if (unit !== undefined) test.unit = unit;
        if (questions !== undefined) test.questions = questions;

        const savedTest = await test.save();
        res.json(savedTest);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update test: ' + err.message });
    }
});

// DELETE /api/admin/tests/:id
router.delete('/tests/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        await Attempt.deleteMany({ testId: req.params.id });
        await Test.findByIdAndDelete(req.params.id);

        res.json({ message: 'Test deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete test: ' + err.message });
    }
});

// ============================================
// FLAG MANAGEMENT ROUTES
// ============================================

// GET /api/admin/flags — List flags (cursor-paginated, filterable by status)
router.get('/flags', async (req, res) => {
    try {
        const { status, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        const match = {};
        if (status) match.status = status;
        if (cursor) {
            if (mongoose.Types.ObjectId.isValid(cursor)) {
                match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
            }
        }

        const flags = await Flag.find(match)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate('userId', 'email displayName')
            .populate('testId', 'title')
            .lean();

        const hasMore = flags.length > limit;
        const results = hasMore ? flags.slice(0, limit) : flags;
        const nextCursor = hasMore ? results[results.length - 1]._id : null;

        const openCount = await Flag.countDocuments({ status: 'open' });

        res.json({ flags: results, nextCursor, openCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch flags: ' + err.message });
    }
});

// GET /api/admin/flags/count — Get open flags count (for nav badge)
router.get('/flags/count', async (req, res) => {
    try {
        const openCount = await Flag.countDocuments({ status: 'open' });
        res.json({ openCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to count flags: ' + err.message });
    }
});

// PATCH /api/admin/flags/:id — Resolve or dismiss a flag
router.patch('/flags/:id', async (req, res) => {
    try {
        const { status, resolution } = req.body;
        if (!['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "resolved" or "dismissed"' });
        }

        const flag = await Flag.findByIdAndUpdate(
            req.params.id,
            { status, resolution: resolution || '' },
            { new: true }
        );

        if (!flag) {
            return res.status(404).json({ message: 'Flag not found' });
        }

        res.json(flag);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update flag: ' + err.message });
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

module.exports = router;
