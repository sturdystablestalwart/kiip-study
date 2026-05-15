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
const logger = require('../utils/logger');

const isTest = process.env.NODE_ENV === 'test';

const magicLinkLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isTest ? 10000 : 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

const magicLinkEmailLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: isTest ? 10000 : 3,
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

// ─── Signup allowlist (OAuth + magic-link) ──────────────────────────────
// Both env vars are CSV. If EITHER is set, signups are gated. If both empty,
// behavior is unchanged (open signup). If both are set, allow on EITHER match.
//   ALLOWED_OAUTH_DOMAINS=foo.com,bar.com   → email must end with @foo.com or @bar.com
//   ALLOWED_EMAILS=alice@x.com,bob@y.com    → email must be in this list
function parseCsvEnv(value) {
    if (!value || typeof value !== 'string') return [];
    return value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

function isEmailAllowedForSignup(email) {
    const domains = parseCsvEnv(process.env.ALLOWED_OAUTH_DOMAINS);
    const emails = parseCsvEnv(process.env.ALLOWED_EMAILS);

    // If neither allowlist is configured, signup is open (default behavior).
    if (domains.length === 0 && emails.length === 0) return true;

    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return false;

    if (emails.length > 0 && emails.includes(normalized)) return true;
    if (domains.length > 0 && domains.some((d) => normalized.endsWith('@' + d))) return true;

    return false;
}

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const rawEmail = profile.emails?.[0]?.value;
            if (!rawEmail) {
                return done(new Error('No email found in Google profile'));
            }
            const email = rawEmail.trim().toLowerCase();

            // Enforce optional signup allowlist (#35).
            if (!isEmailAllowedForSignup(email)) {
                logger.warn({ email }, 'OAuth signup rejected by allowlist');
                return done(null, false, { message: 'Domain not allowed' });
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

// Helper: get the first CLIENT_URL (env may be comma-separated)
function getClientUrl() {
    return (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
}

// GET /api/auth/google/start
router.get('/google/start', authLimiter,
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback
router.get('/google/callback', authLimiter, (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
        const clientUrl = getClientUrl();

        if (err || !user) {
            logger.error({ err }, 'Google OAuth callback error');
            return res.redirect(`${clientUrl}/?auth_error=google_failed`);
        }

        const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: '7d', issuer: 'kiip-study', audience: 'kiip-study-api', algorithm: 'HS256' }
        );

        res.cookie('jwt', token, COOKIE_OPTIONS);
        res.redirect(clientUrl);
    })(req, res, next);
});

// GET /api/auth/me — returns null instead of 401 to avoid browser console errors
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies?.jwt;
        if (!token) return res.json(null);

        const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'kiip-study', audience: 'kiip-study-api', algorithms: ['HS256'] });
        const user = await User.findById(decoded.userId);
        if (!user) return res.json(null);

        res.json({
            _id: user._id,
            email: user.email,
            displayName: user.displayName,
            isAdmin: user.isAdmin,
            preferences: user.preferences
        });
    } catch {
        res.json(null);
    }
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

// ─── Magic-link bot protection (issue #20) ──────────────────────────────
// Generic response used for ALL success-shaped paths (real send, honeypot,
// cooldown, allowlist reject). Identical body + similar latency prevent
// timing/existence enumeration.
const MAGIC_LINK_GENERIC_RESPONSE = {
    message: 'If this email is valid, a sign-in link has been sent.',
};

// Per-email cool-down: in-memory Map of { emailLower -> epochMs of last send }.
// 60s threshold per email regardless of IP. Cheap, no extra deps.
const MAGIC_LINK_COOLDOWN_MS = 60 * 1000;
const lastSendByEmail = new Map();

// Reap expired cooldown entries periodically to keep the map bounded.
// Skipped in tests (no need + would keep the Node event loop alive).
if (!isTest) {
    const reaper = setInterval(() => {
        const cutoff = Date.now() - MAGIC_LINK_COOLDOWN_MS;
        for (const [key, ts] of lastSendByEmail) {
            if (ts < cutoff) lastSendByEmail.delete(key);
        }
    }, 5 * 60 * 1000);
    // Don't keep the event loop alive solely because of this timer.
    if (reaper.unref) reaper.unref();
}

// Equalize latency for no-op success paths (honeypot, cooldown) so they
// take a similar amount of time as the real send-mail path. Bots / timing
// attackers should not be able to distinguish them.
function approximateSendDelay() {
    const ms = 50 + Math.floor(Math.random() * 100);
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/auth/magic/send
router.post('/magic/send', magicLinkLimiter, magicLinkEmailLimiter, async (req, res) => {
    try {
        // Honeypot: a hidden field the real form does NOT render. Bots that
        // blindly fill every input get caught here. Respond with the same
        // generic success shape (do NOT leak that we filtered them).
        const honeypot = req.body?.website;
        if (typeof honeypot === 'string' && honeypot.trim() !== '') {
            logger.warn({ ip: req.ip }, 'Magic link honeypot tripped');
            await approximateSendDelay();
            return res.json(MAGIC_LINK_GENERIC_RESPONSE);
        }

        const { email, lang } = req.body || {};
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ message: 'Valid email is required' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        const validLang = ['en', 'ko', 'ru', 'es'].includes(lang) ? lang : 'en';

        // Per-email cool-down (in addition to per-IP rate-limit). Same
        // generic body — do not reveal that the email was recently used.
        const now = Date.now();
        const lastSent = lastSendByEmail.get(normalizedEmail);
        if (lastSent && now - lastSent < MAGIC_LINK_COOLDOWN_MS) {
            logger.info({ email: normalizedEmail }, 'Magic link per-email cooldown hit');
            await approximateSendDelay();
            return res.json(MAGIC_LINK_GENERIC_RESPONSE);
        }

        // Reject signups outside the allowlist (#35) — still respond with
        // the generic body so we don't leak which emails are allowed.
        if (!isEmailAllowedForSignup(normalizedEmail)) {
            logger.warn({ email: normalizedEmail }, 'Magic link signup rejected by allowlist');
            await approximateSendDelay();
            return res.json(MAGIC_LINK_GENERIC_RESPONSE);
        }

        // Mark cooldown BEFORE the slow path so concurrent duplicates don't
        // both fire emails.
        lastSendByEmail.set(normalizedEmail, now);

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

        res.json(MAGIC_LINK_GENERIC_RESPONSE);
    } catch (err) {
        logger.error({ err }, 'Magic link send error');
        res.status(500).json({ message: 'Failed to send sign-in link' });
    }
});

// GET /api/auth/magic/verify
router.get('/magic/verify', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect(`${getClientUrl()}/auth/verify?error=TOKEN_INVALID`);
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const record = await MagicLink.findOneAndUpdate(
            { tokenHash, used: false, expiresAt: { $gt: new Date() } },
            { $set: { used: true, usedAt: new Date() } },
            { new: true }
        );

        const clientUrl = getClientUrl();

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
            // Issue #110: legacy users created before `authMethods` existed
            // (e.g. Google-only users from earlier deploys) may have
            // `authMethods` === undefined/null. Guard before calling .includes.
            // Mirrors the defensive pattern in the Google strategy above.
            if (!user.authMethods || !user.authMethods.includes('magic')) {
                user.authMethods = user.authMethods || [];
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
        logger.error({ err }, 'Magic link verify error');
        const clientUrl = getClientUrl();
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
// Exposed for unit tests — not part of the HTTP surface.
module.exports.isEmailAllowedForSignup = isEmailAllowedForSignup;
module.exports._lastSendByEmail = lastSendByEmail;
module.exports.MAGIC_LINK_COOLDOWN_MS = MAGIC_LINK_COOLDOWN_MS;
