import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// ─── /api/stats supertest regression — issue #105 ─────────────────────────
//
// Background: server/routes/stats.js:6 destructured `safeError` from
// `../utils/safeError`, but safeError.js exports the function as the module's
// default — so the destructured value was `undefined`. Every catch in
// /api/stats and /api/stats/question-types then tried `undefined(...)`, hit a
// TypeError, and produced a generic 500 with no useful context.
//
// This test mounts the real stats router behind a minimal Express app,
// authenticates via a real JWT cookie (per CLAUDE.md: name=jwt, secret from
// process.env.JWT_SECRET, issuer=kiip-study, audience=kiip-study-api), and:
//   • happy path → asserts 200 with the expected response shape;
//   • error path → forces Attempt.aggregate to reject and asserts a clean
//     structured 500 ({ message: "Failed to load stats: …" }) — the response
//     you get only when safeError is actually callable.
//
// The error-path test is the one that fails without the fix.

// ─── Env must be set BEFORE any server-module import (auth.js throws at
//     load time without JWT_SECRET).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'stats-test-jwt-secret-32chars-min!!';
process.env.NODE_ENV = 'test';

// Use CommonJS require for the entire chain — Mongoose models are
// registered globally and ESM `import` resolution under Vitest opens a
// second module instance, which triggers OverwriteModelError when the
// router's own require() runs. Sticking to require() keeps a single graph.
const require = createRequire(import.meta.url);

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const User = require('../../models/User');
const Attempt = require('../../models/Attempt');

const statsRouter = require('../stats');

const JWT_OPTS = { issuer: 'kiip-study', audience: 'kiip-study-api' };

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/stats', statsRouter);
    return app;
}

function mintJwt(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { ...JWT_OPTS, expiresIn: '1h' });
}

const FAKE_USER_ID = '507f1f77bcf86cd799439011';
const fakeUser = { _id: FAKE_USER_ID, email: 'stats@test.com', isAdmin: false };

let findByIdSpy;
let aggregateSpy;

beforeAll(() => {
    findByIdSpy = vi.spyOn(User, 'findById');
    aggregateSpy = vi.spyOn(Attempt, 'aggregate');
});

afterAll(() => {
    findByIdSpy.mockRestore();
    aggregateSpy.mockRestore();
});

beforeEach(() => {
    findByIdSpy.mockReset();
    aggregateSpy.mockReset();
    findByIdSpy.mockResolvedValue(fakeUser);
});

describe('GET /api/stats — authenticated happy path (issue #105 regression)', () => {
    it('returns 200 with kpis / accuracyTrend / unitBreakdown when DB is empty', async () => {
        // Four aggregations in the GET / handler: kpis, dayBuckets,
        // accuracyTrend, unitBreakdown. All resolve to empty arrays so the
        // handler walks the no-data branch.
        aggregateSpy.mockResolvedValue([]);

        const app = buildApp();
        const token = mintJwt(FAKE_USER_ID);

        const res = await request(app)
            .get('/api/stats')
            .set('Cookie', [`jwt=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('kpis');
        expect(res.body).toHaveProperty('accuracyTrend');
        expect(res.body).toHaveProperty('unitBreakdown');
        expect(res.body.kpis.totalAttempts).toBe(0);
        expect(res.body.kpis.averageScore).toBe(0);
        expect(res.body.kpis.currentStreak).toBe(0);
        expect(res.body.kpis.weakestUnit).toBeNull();
        expect(res.body.accuracyTrend).toEqual([]);
        expect(res.body.unitBreakdown).toEqual([]);
    });

    it('returns 401 without an auth cookie', async () => {
        const app = buildApp();
        const res = await request(app).get('/api/stats');

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Authentication required');
    });
});

describe('GET /api/stats — error path proves safeError is callable (issue #105)', () => {
    it('returns a structured 500 with a string message when aggregation rejects', async () => {
        // Force the catch branch. Without the #105 fix, this call would
        // double-fault: catch (err) → res.status(500).json({ message:
        // safeError('Failed to load stats', err) }) where safeError is
        // `undefined` → TypeError → Express default 500 with no JSON message.
        const dbError = new Error('simulated mongo failure');
        aggregateSpy.mockRejectedValueOnce(dbError);

        const app = buildApp();
        const token = mintJwt(FAKE_USER_ID);

        const res = await request(app)
            .get('/api/stats')
            .set('Cookie', [`jwt=${token}`]);

        expect(res.status).toBe(500);
        // The fix is what makes `message` a real string. With the bug
        // present, the catch handler throws TypeError before .json() runs and
        // the response body is not this shape.
        expect(typeof res.body.message).toBe('string');
        expect(res.body.message).toMatch(/Failed to load stats/);
    });
});
