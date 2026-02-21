const mongoose = require('mongoose');

const SessionAnswerSchema = new mongoose.Schema(
    {
        questionIndex: { type: Number, required: true },
        selectedOptions: [{ type: Number }],
        textAnswer: { type: String },
        orderedItems: [{ type: String }],
        blankAnswers: [{ type: String }]
    },
    { _id: false } // subdoc — no separate _id needed
);

const TestSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    mode: { type: String, enum: ['Test', 'Practice'], required: true },
    answers: [SessionAnswerSchema],
    currentQuestion: { type: Number, default: 0 },
    remainingTime: { type: Number, required: true }, // seconds remaining on the timer
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    lastSavedAt: { type: Date, default: Date.now }
});

// Find an active (or any) session for a specific user + test combination
TestSessionSchema.index({ userId: 1, testId: 1, status: 1 });

// List resumable sessions on the user dashboard, sorted most-recently-saved first
TestSessionSchema.index({ userId: 1, status: 1, lastSavedAt: -1 });

module.exports = mongoose.model('TestSession', TestSessionSchema);
