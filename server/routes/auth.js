const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const rateLimit = require('express-rate-limit');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const crypto = require('crypto');
const MagicLink = require('../models/MagicLink');
const { sendMagicLinkEmail } = require('../utils/magicLinkEmail');

const magicLinkLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

const magicLinkEmailLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body?.email || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests for this email, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many auth requests, please try again later.' },
});

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
};

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('No email found in Google profile'));
            }

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                const isAdmin = email === process.env.ADMIN_EMAIL;

                user = await User.create({
                    googleId: profile.id,
                    email,
                    displayName: profile.displayName || email.split('@')[0],
                    isAdmin,
                    authMethods: ['google'],
                });
            }

            // Sync admin status on every login (allows revoking/granting via env var)
            const shouldBeAdmin = email === process.env.ADMIN_EMAIL;
            if (user.isAdmin !== shouldBeAdmin) {
                user.isAdmin = shouldBeAdmin;
                await user.save();
            }

            // Ensure google is in authMethods
            if (!user.authMethods || !user.authMethods.includes('google')) {
                user.authMethods = user.authMethods || [];
                user.authMethods.push('google');
                await user.save();
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// GET /api/auth/google/start
router.get('/google/start', authLimiter,
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback
router.get('/google/callback', authLimiter,
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
        const token = jwt.sign(
            { userId: req.user._id },
            JWT_SECRET,
            { expiresIn: '7d', issuer: 'kiip-study', audience: 'kiip-study-api', algorithm: 'HS256' }
        );

        res.cookie('jwt', token, COOKIE_OPTIONS);

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(clientUrl);
    }
);

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    res.json({
        _id: req.user._id,
        email: req.user.email,
        displayName: req.user.displayName,
        isAdmin: req.user.isAdmin,
        preferences: req.user.preferences
    });
});

// PATCH /api/auth/preferences
router.patch('/preferences', requireAuth, async (req, res) => {
    const { language, theme } = req.body;
    const updates = {};
    if (language && ['en', 'ko', 'ru', 'es'].includes(language)) {
        updates['preferences.language'] = language;
    }
    if (theme && ['light', 'dark', 'system'].includes(theme)) {
        updates['preferences.theme'] = theme;
    }
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid preferences provided' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ preferences: user.preferences });
});

// POST /api/auth/magic/send
router.post('/magic/send', magicLinkLimiter, magicLinkEmailLimiter, async (req, res) => {
    try {
        const { email, lang } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ message: 'Valid email is required' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const validLang = ['en', 'ko', 'ru', 'es'].includes(lang) ? lang : 'en';

        // Invalidate all pending tokens for this email
        await MagicLink.updateMany(
            { email: normalizedEmail, used: false },
            { $set: { used: true, usedAt: new Date() } }
        );

        // Generate token
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await MagicLink.create({
            tokenHash,
            email: normalizedEmail,
            lang: validLang,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            requestedIp: req.ip,
            requestedUA: req.headers['user-agent'],
        });

        await sendMagicLinkEmail(normalizedEmail, rawToken, validLang);

        res.json({ message: 'If this email is valid, a sign-in link has been sent.' });
    } catch (err) {
        console.error('Magic link send error:', err);
        res.status(500).json({ message: 'Failed to send sign-in link' });
    }
});

// GET /api/auth/magic/verify
router.get('/magic/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/verify?error=TOKEN_INVALID`);
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const record = await MagicLink.findOneAndUpdate(
            { tokenHash, used: false, expiresAt: { $gt: new Date() } },
            { $set: { used: true, usedAt: new Date() } },
            { new: true }
        );

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

        if (!record) {
            const existing = await MagicLink.findOne({ tokenHash });
            if (existing && existing.used) {
                return res.redirect(`${clientUrl}/auth/verify?error=TOKEN_USED`);
            }
            if (existing && existing.expiresAt < new Date()) {
                return res.redirect(`${clientUrl}/auth/verify?error=TOKEN_EXPIRED`);
            }
            return res.redirect(`${clientUrl}/auth/verify?error=TOKEN_INVALID`);
        }

        let user = await User.findOne({ email: record.email });
        if (user) {
            if (!user.authMethods.includes('magic')) {
                user.authMethods.push('magic');
                await user.save();
            }
        } else {
            const isAdmin = record.email === process.env.ADMIN_EMAIL;
            user = await User.create({
                email: record.email,
                displayName: record.email.split('@')[0],
                isAdmin,
                authMethods: ['magic'],
            });
        }

        const shouldBeAdmin = record.email === process.env.ADMIN_EMAIL;
        if (user.isAdmin !== shouldBeAdmin) {
            user.isAdmin = shouldBeAdmin;
            await user.save();
        }

        const jwtToken = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: '7d', issuer: 'kiip-study', audience: 'kiip-study-api', algorithm: 'HS256' }
        );

        res.cookie('jwt', jwtToken, COOKIE_OPTIONS);
        res.redirect(clientUrl);
    } catch (err) {
        console.error('Magic link verify error:', err);
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(`${clientUrl}/auth/verify?error=TOKEN_INVALID`);
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('jwt', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ message: 'Logged out' });
});

module.exports = router;
