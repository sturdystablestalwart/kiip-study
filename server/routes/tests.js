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

// --- GEMINI AI Integration ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseTextWithLLM = async (text) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
        You are an expert KIIP (Korea Immigration and Integration Program) Level 2 instructor.
        Your task is to parse the following text and convert it into a structured practice test.
        The text might be raw study material or an existing mock test.

        REQUIREMENTS:
        1. Generate exactly 20 questions if possible, or as many as the content allows.
        2. Questions must be multiple-choice with 4 options each.
        3. Include a helpful explanation for each answer in Korean.
        4. The output MUST be a valid JSON object matching this structure:
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
              "explanation": "Why the correct answer is right (in Korean)",
              "type": "multiple-choice"
            }
          ]
        }

        TEXT TO PARSE:
        ${text}

        Respond ONLY with the JSON object. Do not include markdown formatting like \`\`\`json.
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

// GET all tests
router.get('/', async (req, res) => {
    try {
        const tests = await Test.find();
        res.json(tests);
    } catch (err) {
        res.status(500).json({ message: err.message });
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

// POST generate test
router.post('/generate', async (req, res) => {
    const { text } = req.body;
    try {
        const data = await parseTextWithLLM(text);
        const newTest = new Test({
            title: data.title,
            questions: data.questions
        });
        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// POST upload image
router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
});

module.exports = router;