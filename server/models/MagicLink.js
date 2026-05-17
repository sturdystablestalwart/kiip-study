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

// Issue #39 — every magic-link send does
// `MagicLink.updateMany({ email, used: false }, ...)` to invalidate any
// pending links for the same address. With only the tokenHash and TTL
// indexes that was a collection scan on every send.
MagicLinkSchema.index({ email: 1, used: 1 });

// TTL expires the document as soon as expiresAt is in the past
// (expireAfterSeconds: 0).  Previous value 3600 left exhausted tokens
// lingering ~50 minutes past their 10-minute usefulness — pure DB bloat.
// Note: MongoDB cannot mutate expireAfterSeconds in place; deploys
// upgrading from the old value need a one-time
//   db.magiclinks.dropIndex('expiresAt_1')
// before this index can be rebuilt with the new value.
// See ops/MIGRATIONS.md.
MagicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MagicLink', MagicLinkSchema);
