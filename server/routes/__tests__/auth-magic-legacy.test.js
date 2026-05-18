import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

// Issue #110 — magic-link verify crashes on legacy users whose `authMethods`
// is `undefined` (e.g. Google-only users created before that field existed).
//
// The verify handler at server/routes/auth.js calls
//     user.authMethods.includes('magic')
// which throws TypeError when authMethods is undefined. The outer try/catch
// then masks the bug as `?error=TOKEN_INVALID`, wasting a valid 10-min token.
//
// These tests reproduce the bug at route level by stubbing the User and
// MagicLink Mongoose model statics directly (mongodb-memory-server isn't in
// this repo's devDependencies, and we must not touch package.json).
//
// We use CommonJS require() to load the route + models so we share the same
// module cache as the route's own require() calls (avoids OverwriteModelError).

// ─── Required env before any module under test loads ───
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-must-be-long-enough-for-validation-32chars';
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:5173';
// passport-google-oauth20 strategy is constructed at module load — supply
// dummy creds so the import succeeds. We never exercise the Google flow here.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';

// Neutralise transitive nodemailer usage from magicLinkEmail util.
vi.mock('nodemailer', () => ({
    default: { createTransport: () => ({ sendMail: vi.fn() }) },
    createTransport: () => ({ sendMail: vi.fn() }),
}));

// ─── Per-test mutable state ───
const mockState = {
    legacyUser: null,            // populated per-test
    magicLinkRecord: null,       // populated per-test
    savedUser: null,             // captured when route calls user.save()
};

// ─── CJS require so we share the module cache with auth.js ───
const require = createRequire(import.meta.url);
const express = require('express');
const cookieParser = require('cookie-parser');
const supertest = require('supertest');
const User = require('../../models/User.js');
const MagicLink = require('../../models/MagicLink.js');

// Patch model statics so the route never hits MongoDB.
User.findOne = vi.fn(async () => mockState.legacyUser);
User.create = vi.fn(async (doc) => doc);
MagicLink.findOneAndUpdate = vi.fn(async () => mockState.magicLinkRecord);
MagicLink.findOne = vi.fn(async () => mockState.magicLinkRecord);
MagicLink.updateMany = vi.fn(async () => ({ acknowledged: true }));
MagicLink.create = vi.fn(async (doc) => doc);

const authRouter = require('../auth.js');

function buildApp() {
    const app = express();
    app.use(express.json());
    // Issue #487 — cookie-parser now needs a secret because the
    // auth route sets `signed: true` on the jwt cookie.
    app.use(cookieParser('test-cookie-secret'));
    app.use('/api/auth', authRouter);
    return app;
}

const request = supertest(buildApp());

// ─── Helper: generate a raw token + matching hash ───
function makeToken() {
    const raw = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, tokenHash };
}

describe('GET /api/auth/magic/verify — legacy user without authMethods (#110)', () => {
    beforeEach(() => {
        mockState.legacyUser = null;
        mockState.magicLinkRecord = null;
        mockState.savedUser = null;
    });

    it('does NOT crash and redirects to the client (with a jwt cookie) for a legacy Google-only user whose authMethods is undefined', async () => {
        const { raw, tokenHash } = makeToken();

        // Legacy user — created before `authMethods` existed. `authMethods` is
        // literally `undefined` on the doc (insertOne bypass in real DB).
        const legacyUser = {
            _id: 'legacyUserId',
            email: 'legacy@example.com',
            isAdmin: false,
            authMethods: undefined,        // ← the bug condition
            async save() {
                mockState.savedUser = {
                    _id: this._id,
                    email: this.email,
                    isAdmin: this.isAdmin,
                    authMethods: this.authMethods,
                };
            },
        };
        mockState.legacyUser = legacyUser;

        mockState.magicLinkRecord = {
            tokenHash,
            email: 'legacy@example.com',
            used: false,
            expiresAt: new Date(Date.now() + 9 * 60 * 1000),
        };

        const res = await request.get(`/api/auth/magic/verify?token=${encodeURIComponent(raw)}`);

        // Bug repro: before the fix, the route's catch block redirected to
        // /auth/verify?error=TOKEN_INVALID. After the fix it redirects to the
        // client root (CLIENT_URL).
        expect(res.status).toBe(302);
        expect(res.headers.location).not.toMatch(/error=TOKEN_INVALID/);
        expect(res.headers.location).toBe('http://localhost:5173');

        // A jwt cookie was set — success path.
        const setCookie = res.headers['set-cookie'];
        expect(setCookie).toBeDefined();
        const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
        expect(cookieHeader).toMatch(/jwt=/);

        // Route saved the user with authMethods populated (including 'magic').
        expect(mockState.savedUser).not.toBeNull();
        expect(Array.isArray(mockState.savedUser.authMethods)).toBe(true);
        expect(mockState.savedUser.authMethods).toContain('magic');
    });

    it('does NOT crash and behaves correctly for a legacy user whose authMethods is null', async () => {
        const { raw, tokenHash } = makeToken();

        const legacyUser = {
            _id: 'legacyUserId2',
            email: 'legacy2@example.com',
            isAdmin: false,
            authMethods: null,             // null variant
            async save() {
                mockState.savedUser = {
                    authMethods: this.authMethods,
                };
            },
        };
        mockState.legacyUser = legacyUser;

        mockState.magicLinkRecord = {
            tokenHash,
            email: 'legacy2@example.com',
            used: false,
            expiresAt: new Date(Date.now() + 9 * 60 * 1000),
        };

        const res = await request.get(`/api/auth/magic/verify?token=${encodeURIComponent(raw)}`);

        expect(res.status).toBe(302);
        expect(res.headers.location).not.toMatch(/error=/);
        expect(mockState.savedUser.authMethods).toContain('magic');
    });

    // ─── Issue #140 schema-level guard ───
    it('User schema gives new docs an empty authMethods array by default (#140)', () => {
        const u = new User({ email: 'sanity@example.com' });
        // .toObject() collapses Mongoose's DocumentArray to a plain Array.
        expect(u.authMethods).toBeDefined();
        expect(Array.isArray(u.authMethods)).toBe(true);
        expect(u.authMethods.length).toBe(0);
        // And .includes() does not throw on a fresh doc — closing the loop on #110.
        expect(u.authMethods.includes('magic')).toBe(false);
    });

    it('does not double-add "magic" for an existing magic-method user', async () => {
        const { raw, tokenHash } = makeToken();

        const user = {
            _id: 'existingMagicUserId',
            email: 'magic-user@example.com',
            isAdmin: false,
            authMethods: ['magic'],
            saveCalls: 0,
            async save() {
                this.saveCalls++;
                mockState.savedUser = { authMethods: this.authMethods };
            },
        };
        mockState.legacyUser = user;
        mockState.magicLinkRecord = {
            tokenHash,
            email: 'magic-user@example.com',
            used: false,
            expiresAt: new Date(Date.now() + 9 * 60 * 1000),
        };

        const res = await request.get(`/api/auth/magic/verify?token=${encodeURIComponent(raw)}`);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('http://localhost:5173');
        // authMethods unchanged — still exactly ['magic']
        expect(user.authMethods).toEqual(['magic']);
    });
});
