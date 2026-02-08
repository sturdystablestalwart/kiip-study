const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
});

const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    image: { type: String }, // URL or path to uploaded image
    options: [OptionSchema],
    explanation: { type: String }, // Optional explanation for practice mode
    type: { type: String, default: 'multiple-choice' } // multiple-choice, essay, etc.
});

const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Test', TestSchema);
