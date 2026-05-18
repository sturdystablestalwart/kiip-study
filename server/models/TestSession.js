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

// Issue #453 — partial unique index: at most one ACTIVE session per
// (userId, testId). Closes the race in POST /api/sessions/start where
// two parallel requests both pass the findOne check and create
// duplicate active sessions. Completed/abandoned sessions are exempt
// (they accumulate; the partial TTL below handles them).
TestSessionSchema.index(
    { userId: 1, testId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'active' },
    },
);

// List resumable sessions on the user dashboard, sorted most-recently-saved first
TestSessionSchema.index({ userId: 1, status: 1, lastSavedAt: -1 });

// Issue #148 — partial TTL on completed/abandoned sessions.  Active
// sessions are exempt (they're the user's resumable progress) but
// once a session is done it has no further read use beyond a short
// reporting tail.  30 days keeps the analytics window while bounding
// long-term DB bloat.  MagicLink uses the same expireAfterSeconds
// pattern.
TestSessionSchema.index(
    { lastSavedAt: 1 },
    {
        expireAfterSeconds: 30 * 24 * 3600,
        partialFilterExpression: { status: { $in: ['completed', 'abandoned'] } },
    },
);

module.exports = mongoose.model('TestSession', TestSessionSchema);
