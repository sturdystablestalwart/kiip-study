const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

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
                    isAdmin
                });
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
router.get('/google/start',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback
router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
        const token = jwt.sign(
            { userId: req.user._id },
            JWT_SECRET,
            { expiresIn: '7d' }
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('jwt', { path: '/' });
    res.json({ message: 'Logged out' });
});

module.exports = router;
