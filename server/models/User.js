const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    googleId: { type: String, default: null },
    displayName: { type: String },
    isAdmin: { type: Boolean, default: false },
    authMethods: { type: [{ type: String, enum: ['google', 'magic'] }], default: [] },
    preferences: {
        language: { type: String, enum: ['en', 'ko', 'ru', 'es'], default: 'en' },
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
