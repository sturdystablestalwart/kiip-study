const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    selectedOptions: [{ type: Number }],
    textAnswer: { type: String },
    orderedItems: [{ type: Number }],
    blankAnswers: [{ type: String }],
    isCorrect: { type: Boolean, required: true },
    isOverdue: { type: Boolean, default: false }
});

const AttemptSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    duration: { type: Number, required: true }, // in seconds
    overdueTime: { type: Number, default: 0 }, // seconds spent after timer expired
    answers: [AnswerSchema],
    mode: { type: String, enum: ['Practice', 'Test', 'Endless'], default: 'Test' },
    sourceQuestions: [{
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
        questionIndex: { type: Number }
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attempt', AttemptSchema);
