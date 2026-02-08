const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const multer = require('multer');

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const { GoogleGenerativeAI } = require("@google/generative-ai");
const Attempt = require('../models/Attempt');

// --- GEMINI AI Integration ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseTextWithLLM = async (text) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        return JSON.parse(jsonText);
    } catch (err) {
        console.error("LLM Parsing Error:", err);
        throw new Error("Failed to parse text with AI.");
    }
};

// GET all tests with last attempt
router.get('/', async (req, res) => {
    try {
        const tests = await Test.find().lean();
        const testsWithAttempts = await Promise.all(tests.map(async (test) => {
            const lastAttempt = await Attempt.findOne({ testId: test._id }).sort({ createdAt: -1 });
            return { ...test, lastAttempt };
        }));
        res.json(testsWithAttempts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST save attempt
router.post('/:id/attempt', async (req, res) => {
    try {
        const attempt = new Attempt({
            testId: req.params.id,
            ...req.body
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

// POST generate from file
router.post('/generate-from-file', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    
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

        const data = await parseTextWithLLM(text);
        const newTest = new Test({
            title: data.title,
            questions: data.questions,
            category: 'File Upload'
        });
        const savedTest = await newTest.save();
        
        // Clean up temp file
        fs.unlinkSync(filePath);
        
        res.status(201).json(savedTest);
    } catch (err) {
        console.error("File Generation Error:", err);
        res.status(400).json({ message: err.message });
    }
});

// GET specific test
router.get('/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Cannot find test' });
        res.json(test);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = { router, parseTextWithLLM };