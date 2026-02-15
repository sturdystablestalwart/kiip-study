const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isCorrect: { type: Boolean, required: true, default: false }
});

const QuestionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    image: { type: String },
    options: [OptionSchema],
    explanation: { type: String },
    type: { type: String, default: 'multiple-choice' }
});

const TestSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, default: 'General' },
    description: { type: String },
    level: { type: String },
    unit: { type: String },
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now }
});

// Full-text search index on title, category, description
TestSchema.index({ title: 'text', category: 'text', description: 'text' });

// Compound index for filtering + sorting
TestSchema.index({ level: 1, unit: 1, createdAt: -1 });

module.exports = mongoose.model('Test', TestSchema);
