const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    selectedOption: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    isOverdue: { type: Boolean, default: false }
});

const AttemptSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    duration: { type: Number, required: true }, // in seconds
    overdueTime: { type: Number, default: 0 }, // seconds spent after timer expired
    answers: [AnswerSchema],
    mode: { type: String, enum: ['Practice', 'Test'], default: 'Test' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attempt', AttemptSchema);
