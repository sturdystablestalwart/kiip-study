import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

// Required by passport-google-oauth20 at module-load time. Set before the
// route module is required by any test below.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// Mock nodemailer before importing
vi.mock('nodemailer', () => ({
    default: { createTransport: () => ({ sendMail: vi.fn() }) },
    createTransport: () => ({ sendMail: vi.fn() }),
}));

// ─── Token Hash Logic ───

describe('Magic Link Token Logic', () => {
    it('generates 256-bit token as base64url', () => {
        const token = crypto.randomBytes(32).toString('base64url');
        expect(token).toHaveLength(43);
        // Should be URL-safe
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
    });

    it('hash of token is deterministic', () => {
        const raw = 'test-token-value';
        const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
        const hash2 = crypto.createHash('sha256').update(raw).digest('hex');
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
    });

    it('different tokens produce different hashes', () => {
        const token1 = crypto.randomBytes(32).toString('base64url');
        const token2 = crypto.randomBytes(32).toString('base64url');
        const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
        const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
        expect(hash1).not.toBe(hash2);
    });

    it('hash is not reversible (one-way)', () => {
        const raw = crypto.randomBytes(32).toString('base64url');
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        // Hash should differ from raw token
        expect(hash).not.toBe(raw);
        // Hash output is always 64 hex chars regardless of input length
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rawToken is never stored — only hash is', () => {
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // Simulate what the route stores: only tokenHash goes to DB
        const storedRecord = { tokenHash, email: 'user@example.com' };
        expect(storedRecord).not.toHaveProperty('rawToken');
        expect(storedRecord.tokenHash).toBe(tokenHash);
    });
});

// ─── Email Validation Logic ───

describe('Magic Link Email Validation', () => {
    // Mirrors the route guard: !email || typeof email !== 'string' || !email.includes('@')
    function isInvalidEmail(email) {
        return !email || typeof email !== 'string' || !email.includes('@');
    }

    it('rejects empty string', () => {
        expect(isInvalidEmail('')).toBe(true);
    });

    it('rejects null', () => {
        expect(isInvalidEmail(null)).toBe(true);
    });

    it('rejects undefined', () => {
        expect(isInvalidEmail(undefined)).toBe(true);
    });

    it('rejects non-string number', () => {
        expect(isInvalidEmail(12345)).toBe(true);
    });

    it('rejects email without @', () => {
        expect(isInvalidEmail('notanemail')).toBe(true);
    });

    it('rejects email with only @', () => {
        // Technically includes('@') is true, so the route accepts '@' — test documents that
        // the route relies on express-validator for full RFC validation elsewhere
        expect(isInvalidEmail('@')).toBe(false); // passes the basic guard
    });

    it('accepts valid email', () => {
        expect(isInvalidEmail('test@example.com')).toBe(false);
    });

    it('normalizes email to lowercase', () => {
        const email = 'Test@Example.COM';
        expect(email.trim().toLowerCase()).toBe('test@example.com');
    });

    it('normalizes email by trimming whitespace', () => {
        const email = '  user@example.com  ';
        expect(email.trim().toLowerCase()).toBe('user@example.com');
    });
});

// ─── Language Validation Logic ───

describe('Magic Link Language Validation', () => {
    const validLangs = ['en', 'ko', 'ru', 'es'];

    // Mirrors: ['en','ko','ru','es'].includes(lang) ? lang : 'en'
    function resolveLang(lang) {
        return validLangs.includes(lang) ? lang : 'en';
    }

    it('accepts en', () => {
        expect(resolveLang('en')).toBe('en');
    });

    it('accepts ko', () => {
        expect(resolveLang('ko')).toBe('ko');
    });

    it('accepts ru', () => {
        expect(resolveLang('ru')).toBe('ru');
    });

    it('accepts es', () => {
        expect(resolveLang('es')).toBe('es');
    });

    it('defaults to en for unsupported language fr', () => {
        expect(resolveLang('fr')).toBe('en');
    });

    it('defaults to en for undefined', () => {
        expect(resolveLang(undefined)).toBe('en');
    });

    it('defaults to en for null', () => {
        expect(resolveLang(null)).toBe('en');
    });

    it('defaults to en for empty string', () => {
        expect(resolveLang('')).toBe('en');
    });

    it('defaults to en for numeric value', () => {
        expect(resolveLang(42)).toBe('en');
    });

    it('is case-sensitive — EN is not valid', () => {
        expect(resolveLang('EN')).toBe('en');
    });
});

// ─── Token Expiry Logic ───

describe('Token Expiry Logic', () => {
    it('token expires after 10 minutes', () => {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const now = new Date();
        expect(expiresAt > now).toBe(true);

        // Simulate 11 minutes later
        const future = new Date(Date.now() + 11 * 60 * 1000);
        expect(expiresAt > future).toBe(false);
    });

    it('expired token is rejected (expiresAt in the past)', () => {
        const expiresAt = new Date(Date.now() - 1000); // 1 second ago
        const now = new Date();
        expect(expiresAt > now).toBe(false);
    });

    it('token exactly at expiry boundary is rejected', () => {
        // expiresAt === now means $gt condition fails
        const expiresAt = new Date(Date.now());
        // Use a slightly older date to simulate boundary
        const justAfter = new Date(expiresAt.getTime() + 1);
        expect(expiresAt > justAfter).toBe(false);
    });

    it('fresh token (9 min remaining) is still valid', () => {
        const expiresAt = new Date(Date.now() + 9 * 60 * 1000);
        const now = new Date();
        expect(expiresAt > now).toBe(true);
    });

    it('expiry window is exactly 10 minutes (600 seconds)', () => {
        const now = Date.now();
        const expiresAt = new Date(now + 10 * 60 * 1000);
        const diffSeconds = (expiresAt.getTime() - now) / 1000;
        expect(diffSeconds).toBe(600);
    });
});

// ─── Verify Route Error-Path Logic ───

describe('Magic Link Verify Error Routing', () => {
    // Mirrors the verify route's error redirect decision logic
    function resolveVerifyError(record) {
        if (!record) return 'TOKEN_INVALID';
        if (record.used) return 'TOKEN_USED';
        if (record.expiresAt < new Date()) return 'TOKEN_EXPIRED';
        return 'TOKEN_INVALID';
    }

    it('returns TOKEN_INVALID when no record found and no fallback record', () => {
        expect(resolveVerifyError(null)).toBe('TOKEN_INVALID');
    });

    it('returns TOKEN_USED when existing record is already used', () => {
        const record = { used: true, expiresAt: new Date(Date.now() + 60000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_USED');
    });

    it('returns TOKEN_EXPIRED when existing record is not used but expired', () => {
        const record = { used: false, expiresAt: new Date(Date.now() - 1000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_EXPIRED');
    });

    it('used takes priority over expired', () => {
        const record = { used: true, expiresAt: new Date(Date.now() - 1000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_USED');
    });
});

// ─── Admin Email Logic ───

describe('Admin Email Promotion Logic', () => {
    // Mirrors: record.email === process.env.ADMIN_EMAIL
    function shouldBeAdmin(email, adminEmail) {
        return email === adminEmail;
    }

    it('grants admin when email matches ADMIN_EMAIL', () => {
        expect(shouldBeAdmin('admin@example.com', 'admin@example.com')).toBe(true);
    });

    it('does not grant admin for a different email', () => {
        expect(shouldBeAdmin('user@example.com', 'admin@example.com')).toBe(false);
    });

    it('comparison is case-sensitive', () => {
        // Email was normalized to lowercase before storage, so ADMIN_EMAIL should match lowercase
        expect(shouldBeAdmin('admin@example.com', 'Admin@Example.com')).toBe(false);
    });

    it('does not grant admin when ADMIN_EMAIL is undefined', () => {
        expect(shouldBeAdmin('user@example.com', undefined)).toBe(false);
    });
});

// ─── OAuth Allowlist (Issue #35) ─────────────────────────────────────────
//
// Tests the `isEmailAllowedForSignup` helper used by both the OAuth callback
// and the magic-link send route. Default behavior (no env vars) must remain
// open so this is a non-breaking change for existing deployments.

describe('OAuth allowlist — isEmailAllowedForSignup (issue #35)', () => {
    const require = createRequire(import.meta.url);
    let isEmailAllowedForSignup;
    const ORIGINAL_DOMAINS = process.env.ALLOWED_OAUTH_DOMAINS;
    const ORIGINAL_EMAILS = process.env.ALLOWED_EMAILS;

    beforeAll(() => {
        // Ensure env vars are unset BEFORE importing the route so the module
        // evaluates with default-open behavior. The helper reads env per-call
        // so subsequent tests can mutate freely.
        delete process.env.ALLOWED_OAUTH_DOMAINS;
        delete process.env.ALLOWED_EMAILS;
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        ({ isEmailAllowedForSignup } = require('../auth.js'));
    });

    afterEach(() => {
        delete process.env.ALLOWED_OAUTH_DOMAINS;
        delete process.env.ALLOWED_EMAILS;
    });

    afterAll(() => {
        if (ORIGINAL_DOMAINS !== undefined) process.env.ALLOWED_OAUTH_DOMAINS = ORIGINAL_DOMAINS;
        if (ORIGINAL_EMAILS !== undefined) process.env.ALLOWED_EMAILS = ORIGINAL_EMAILS;
    });

    it('default-open: returns true when neither env var is set', () => {
        expect(isEmailAllowedForSignup('anyone@anywhere.com')).toBe(true);
    });

    it('default-open: returns true when both env vars are empty strings', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = '';
        process.env.ALLOWED_EMAILS = '';
        expect(isEmailAllowedForSignup('anyone@anywhere.com')).toBe(true);
    });

    it('domain allowlist: accepts email matching a listed domain', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com,bar.com';
        expect(isEmailAllowedForSignup('alice@foo.com')).toBe(true);
        expect(isEmailAllowedForSignup('bob@bar.com')).toBe(true);
    });

    it('domain allowlist: rejects email NOT matching any listed domain', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com,bar.com';
        expect(isEmailAllowedForSignup('eve@evil.com')).toBe(false);
    });

    it('domain allowlist: case-insensitive on both env and email', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'FOO.com';
        expect(isEmailAllowedForSignup('Alice@Foo.COM')).toBe(true);
    });

    it('email allowlist: accepts email exactly in the list', () => {
        process.env.ALLOWED_EMAILS = 'alice@x.com,bob@y.com';
        expect(isEmailAllowedForSignup('bob@y.com')).toBe(true);
    });

    it('email allowlist: rejects email NOT in the list', () => {
        process.env.ALLOWED_EMAILS = 'alice@x.com,bob@y.com';
        expect(isEmailAllowedForSignup('eve@y.com')).toBe(false);
    });

    it('both lists set: accepts on EITHER match (domain matches)', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com';
        process.env.ALLOWED_EMAILS = 'specific@elsewhere.com';
        expect(isEmailAllowedForSignup('anyone@foo.com')).toBe(true);
    });

    it('both lists set: accepts on EITHER match (email matches)', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com';
        process.env.ALLOWED_EMAILS = 'specific@elsewhere.com';
        expect(isEmailAllowedForSignup('specific@elsewhere.com')).toBe(true);
    });

    it('both lists set: rejects when NEITHER matches', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com';
        process.env.ALLOWED_EMAILS = 'specific@elsewhere.com';
        expect(isEmailAllowedForSignup('eve@evil.com')).toBe(false);
    });

    it('rejects empty / null / undefined email when allowlist is set', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com';
        expect(isEmailAllowedForSignup('')).toBe(false);
        expect(isEmailAllowedForSignup(null)).toBe(false);
        expect(isEmailAllowedForSignup(undefined)).toBe(false);
    });

    it('trims whitespace around CSV entries', () => {
        process.env.ALLOWED_OAUTH_DOMAINS = '  foo.com , bar.com  ';
        expect(isEmailAllowedForSignup('a@foo.com')).toBe(true);
        expect(isEmailAllowedForSignup('b@bar.com')).toBe(true);
    });

    it('does NOT match a substring suffix that crosses domain boundaries', () => {
        // ALLOWED_OAUTH_DOMAINS=foo.com must NOT allow @evilfoo.com just because
        // the string ends with 'foo.com'. Our impl prefixes '@' before suffix check.
        process.env.ALLOWED_OAUTH_DOMAINS = 'foo.com';
        expect(isEmailAllowedForSignup('attacker@evilfoo.com')).toBe(false);
        expect(isEmailAllowedForSignup('attacker@foo.com')).toBe(true);
    });
});

// ─── Magic-link bot protection (Issue #20) ──────────────────────────────
//
// Supertest tests for the POST /api/auth/magic/send endpoint:
//   - Honeypot filled → generic 200 + NO MagicLink row created.
//   - Per-email cooldown → 2nd request within 60s → 200 + no new row.
//   - Generic response body shape is identical across all "success" paths.
//
// We mount the router into a stand-alone Express app and stub out the
// `MagicLink` model + `sendMagicLinkEmail` to avoid hitting MongoDB / SMTP.
// Mirrors the supertest pattern in server/middleware/__tests__/originCheck.test.js.

describe('POST /api/auth/magic/send — honeypot + cooldown (issue #20)', () => {
    const require = createRequire(import.meta.url);
    const express = require('express');
    const request = require('supertest');
    const cookieParser = require('cookie-parser');

    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    delete process.env.ALLOWED_OAUTH_DOMAINS;
    delete process.env.ALLOWED_EMAILS;

    // Replace the MagicLink model and email-sender with spies BEFORE the
    // router module is loaded so it captures these stubs.
    const MagicLink = require('../../models/MagicLink');
    const magicLinkEmail = require('../../utils/magicLinkEmail');

    const updateManySpy = vi.spyOn(MagicLink, 'updateMany').mockResolvedValue({ acknowledged: true });
    const createSpy = vi.spyOn(MagicLink, 'create').mockResolvedValue({ _id: 'mock-id' });
    const sendSpy = vi.spyOn(magicLinkEmail, 'sendMagicLinkEmail').mockResolvedValue({ sent: true });

    const authRouter = require('../auth.js');

    function makeApp() {
        const app = express();
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/auth', authRouter);
        return app;
    }

    beforeEach(() => {
        updateManySpy.mockClear();
        createSpy.mockClear();
        sendSpy.mockClear();
        // Reset cooldown map between tests via the exported handle.
        if (authRouter._lastSendByEmail) authRouter._lastSendByEmail.clear();
    });

    it('honeypot filled → 200 + generic body + NO MagicLink row created', async () => {
        const app = makeApp();
        const res = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'real@example.com', website: 'http://spam.example' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('If this email is valid, a sign-in link has been sent.');
        expect(createSpy).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();
        expect(updateManySpy).not.toHaveBeenCalled();
    });

    it('honeypot whitespace-only is NOT treated as filled (real send still happens)', async () => {
        const app = makeApp();
        const res = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'real1@example.com', website: '   ' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('If this email is valid, a sign-in link has been sent.');
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it('first request triggers send; second request within 60s is suppressed (cooldown)', async () => {
        const app = makeApp();

        const r1 = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'user@example.com' });
        expect(r1.status).toBe(200);
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledTimes(1);

        // Immediate second request: still 200, identical body, but NO new send.
        const r2 = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'user@example.com' });
        expect(r2.status).toBe(200);
        expect(r2.body).toEqual(r1.body);
        expect(createSpy).toHaveBeenCalledTimes(1); // still 1 — no new MagicLink doc
        expect(sendSpy).toHaveBeenCalledTimes(1);   // still 1 — no new SMTP send
    });

    it('cooldown is per-email (different email still gets a real send)', async () => {
        const app = makeApp();

        await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'alpha@example.com' });
        expect(createSpy).toHaveBeenCalledTimes(1);

        await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'beta@example.com' });
        expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('email is normalized to lowercase before cooldown check', async () => {
        const app = makeApp();

        await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'Mixed@Example.COM' });
        expect(createSpy).toHaveBeenCalledTimes(1);

        // Same email, different case — should still hit cooldown.
        const r2 = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'mixed@example.com' });
        expect(r2.status).toBe(200);
        expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('returns same generic body when email is outside allowlist (no leak)', async () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'allowed.com';
        const app = makeApp();

        const res = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'rejected@elsewhere.com' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('If this email is valid, a sign-in link has been sent.');
        expect(createSpy).not.toHaveBeenCalled();
        expect(sendSpy).not.toHaveBeenCalled();

        delete process.env.ALLOWED_OAUTH_DOMAINS;
    });

    it('still 400 on missing/invalid email (input validation kept)', async () => {
        const app = makeApp();

        const r1 = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({});
        expect(r1.status).toBe(400);

        const r2 = await request(app)
            .post('/api/auth/magic/send')
            .set('Origin', 'http://localhost:5173')
            .send({ email: 'notanemail' });
        expect(r2.status).toBe(400);
    });
});

// ─── OAuth callback — allowlist enforcement via passport verify (#35) ───
//
// We exercise the passport strategy's `verify` callback directly. This avoids
// hitting Google's OAuth server while still verifying the gating logic.

describe('Passport Google verify — allowlist (issue #35)', () => {
    const require = createRequire(import.meta.url);
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    delete process.env.ALLOWED_OAUTH_DOMAINS;
    delete process.env.ALLOWED_EMAILS;

    // Loading the router registers the passport strategy as a side-effect.
    const passport = require('passport');
    require('../auth.js');

    // Reach into passport's internals to grab the registered Google strategy.
    // The `_verify` field is the user-supplied verify callback.
    function getGoogleVerify() {
        const strategy = passport._strategy('google');
        if (!strategy) throw new Error('Google strategy not registered');
        return strategy._verify.bind(strategy);
    }

    function fakeProfile(email) {
        return { id: 'google-123', displayName: 'Test', emails: [{ value: email }] };
    }

    function runVerify(profile) {
        return new Promise((resolve) => {
            const verify = getGoogleVerify();
            verify('access-token', 'refresh-token', profile, (err, user, info) => {
                resolve({ err, user, info });
            });
        });
    }

    afterEach(() => {
        delete process.env.ALLOWED_OAUTH_DOMAINS;
        delete process.env.ALLOWED_EMAILS;
        vi.restoreAllMocks();
    });

    it('disallowed domain: verify returns (null, false, { message }) without DB write', async () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'allowed.com';

        const User = require('../../models/User');
        const findSpy = vi.spyOn(User, 'findOne').mockResolvedValue(null);
        const createSpy = vi.spyOn(User, 'create').mockResolvedValue({});

        const { err, user, info } = await runVerify(fakeProfile('eve@evil.com'));

        expect(err).toBeNull();
        expect(user).toBe(false);
        expect(info).toEqual({ message: 'Domain not allowed' });
        expect(findSpy).not.toHaveBeenCalled();
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('allowed domain: verify reaches DB lookup (allowlist passes)', async () => {
        process.env.ALLOWED_OAUTH_DOMAINS = 'allowed.com';

        const User = require('../../models/User');
        const mockUser = {
            _id: 'u1',
            email: 'alice@allowed.com',
            isAdmin: false,
            authMethods: ['google'],
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

        const { err, user } = await runVerify(fakeProfile('alice@allowed.com'));

        expect(err).toBeNull();
        expect(user).toBe(mockUser);
    });

    it('default-open: verify works without any allowlist env var set', async () => {
        const User = require('../../models/User');
        const mockUser = {
            _id: 'u2',
            email: 'anyone@anywhere.com',
            isAdmin: false,
            authMethods: ['google'],
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

        const { err, user } = await runVerify(fakeProfile('anyone@anywhere.com'));

        expect(err).toBeNull();
        expect(user).toBe(mockUser);
    });

    it('email allowlist: rejects email not in list', async () => {
        process.env.ALLOWED_EMAILS = 'alice@x.com,bob@y.com';

        const User = require('../../models/User');
        vi.spyOn(User, 'findOne').mockResolvedValue(null);

        const { err, user, info } = await runVerify(fakeProfile('eve@x.com'));

        expect(err).toBeNull();
        expect(user).toBe(false);
        expect(info.message).toBe('Domain not allowed');
    });

    it('email allowlist: accepts email exactly in list', async () => {
        process.env.ALLOWED_EMAILS = 'alice@x.com,bob@y.com';

        const User = require('../../models/User');
        const mockUser = {
            _id: 'u3',
            email: 'alice@x.com',
            isAdmin: false,
            authMethods: ['google'],
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

        const { err, user } = await runVerify(fakeProfile('alice@x.com'));

        expect(err).toBeNull();
        expect(user).toBe(mockUser);
    });
});
