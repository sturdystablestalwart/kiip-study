const mongoose = require('mongoose');

const FlagSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    questionIndex: { type: Number },
    reason: {
        type: String,
        required: true,
        enum: ['incorrect-answer', 'unclear-question', 'typo', 'other']
    },
    note: { type: String, maxlength: 500 },
    status: {
        type: String,
        enum: ['open', 'resolved', 'dismissed'],
        default: 'open'
    },
    resolution: { type: String }
}, { timestamps: true });

FlagSchema.index({ userId: 1, testId: 1, questionIndex: 1 }, { unique: true });
FlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Flag', FlagSchema);
