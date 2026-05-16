const mongoose = require('mongoose');

const SessionAnswerSchema = new mongoose.Schema(
    {
        questionIndex: { type: Number, required: true },
        selectedOptions: [{ type: Number }],
        textAnswer: { type: String },
        // Indices into the question's `items` array. Must stay `[Number]`
        // to match Attempt.AnswerSchema.orderedItems and the strict `===`
        // comparison in utils/scoring.js (issue #106). Declaring this as
        // `[String]` causes Mongoose to cast every submitted index to a
        // string, which then never compares equal to the numeric
        // question.correctOrder values — silently scoring every ordering
        // question wrong on the session-submit path.
        orderedItems: [{ type: Number }],
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
