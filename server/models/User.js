const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String },
    isAdmin: { type: Boolean, default: false },
    preferences: {
        language: { type: String, enum: ['en', 'ko', 'ru', 'es'], default: 'en' },
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
