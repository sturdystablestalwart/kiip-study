const mongoose = require('mongoose');

const MagicLinkSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    lang: { type: String, enum: ['en', 'ko', 'ru', 'es'], default: 'en' },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
    requestedIp: { type: String },
    requestedUA: { type: String },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

MagicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('MagicLink', MagicLinkSchema);
