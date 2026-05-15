// Set required env vars BEFORE any module loads (auth.js throws on import without them).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

// ─── In-memory state ───
let mockUser = null;
// attempts: { _id, userId, testId, score, totalQuestions, ... }
let attemptStore = [];

let app;

beforeAll(async () => {
    // 1) Monkey-patch Attempt model
    const AttemptModel = requireCJS('../../models/Attempt.js');

    // Simulate the aggregation pipeline used in /api/review/difficulty.
    // We only support the shape of stages this route uses, so the post-fix
    // pipeline (which adds `userId` to $match) is honoured.
    AttemptModel.aggregate = async (pipeline) => {
        let rows = attemptStore.slice();

        for (const stage of pipeline) {
            if (stage.$match) {
                const m = stage.$match;
                rows = rows.filter((a) => {
                    if (m.testId) {
                        if (m.testId.$exists && (a.testId === undefined || a.testId === null)) return false;
                        if (m.testId.$ne === null && (a.testId === null || a.testId === undefined)) return false;
                    }
                    if (m.userId !== undefined) {
                        // Compare via string to handle ObjectId vs string ids.
                        if (String(a.userId) !== String(m.userId)) return false;
                    }
                    return true;
                });
                continue;
            }
            if (stage.$group) {
                const map = new Map();
                for (const a of rows) {
                    const key = String(a.testId);
                    if (!map.has(key)) {
                        map.set(key, { _id: a.testId, _sum: 0, _count: 0 });
                    }
                    const acc = map.get(key);
                    const pct = (a.score / a.totalQuestions) * 100;
                    acc._sum += pct;
                    acc._count += 1;
                }
                rows = Array.from(map.values()).map((g) => ({
                    _id: g._id,
                    avgScore: g._count ? g._sum / g._count : 0,
                    attempts: g._count,
                }));
                continue;
            }
            if (stage.$project) {
                rows = rows.map((r) => ({
                    testId: r._id,
                    avgScore: Math.round(r.avgScore),
                    attempts: r.attempts,
                }));
                continue;
            }
        }

        return rows;
    };

    // Stub other Attempt statics used elsewhere in review.js so importing the
    // router doesn't fail on shared module state.
    AttemptModel.find = () => ({
        sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    });

    // Stub Test.find so /failed handler is safe if accidentally exercised.
    const TestModel = requireCJS('../../models/Test.js');
    TestModel.find = () => ({ lean: async () => [] });

    // 2) Monkey-patch the auth middleware
    const auth = requireCJS('../../middleware/auth.js');
    auth.requireAuth = (req, res, next) => {
        if (!mockUser) return res.status(401).json({ message: 'Authentication required' });
        req.user = mockUser;
        next();
    };
    auth.requireAdmin = (req, res, next) => {
        if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
        next();
    };

    // 3) Load the router AFTER patches
    const router = requireCJS('../review.js');
    const a = express();
    a.use(express.json());
    a.use('/api/review', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => {
    attemptStore = [];
    mockUser = null;
});

function seedAttempt({ userId, testId, score, totalQuestions }) {
    attemptStore.push({
        _id: `attempt-${attemptStore.length + 1}`,
        userId,
        testId,
        score,
        totalQuestions,
    });
}

// ─── Issue #127 — GET /api/review/difficulty must be scoped to req.user._id ───

// Valid 24-char hex ObjectId strings (the route wraps req.user._id in
// `new mongoose.Types.ObjectId(...)`, which throws on non-hex input).
const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const USER_LONELY = 'cccccccccccccccccccccccc';
const USER_ADMIN = 'dddddddddddddddddddddddd';
const TEST_1 = 't1';
const TEST_2 = 't2';
const TEST_3 = 't3';

describe('Issue #127 — GET /api/review/difficulty must be scoped per-user', () => {
    it('returns 401 for unauthenticated requests', async () => {
        mockUser = null;
        const res = await request(app).get('/api/review/difficulty');
        expect(res.status).toBe(401);
    });

    it('returns only difficulty stats derived from the caller\'s own attempts', async () => {
        // User A: 2 attempts on test t1 (avg 50%), 1 attempt on test t2 (100%)
        seedAttempt({ userId: USER_A, testId: TEST_1, score: 4, totalQuestions: 10 });
        seedAttempt({ userId: USER_A, testId: TEST_1, score: 6, totalQuestions: 10 });
        seedAttempt({ userId: USER_A, testId: TEST_2, score: 10, totalQuestions: 10 });

        // User B: 1 attempt on test t1 (0%), 1 attempt on test t3 (100%)
        seedAttempt({ userId: USER_B, testId: TEST_1, score: 0, totalQuestions: 10 });
        seedAttempt({ userId: USER_B, testId: TEST_3, score: 10, totalQuestions: 10 });

        mockUser = { _id: USER_A, isAdmin: false };
        const res = await request(app).get('/api/review/difficulty');

        expect(res.status).toBe(200);
        expect(res.body.difficulty).toBeDefined();

        const keys = Object.keys(res.body.difficulty).sort();
        // user-a only touched t1 and t2 — t3 must NOT appear.
        expect(keys).toEqual(['t1', 't2']);

        // attempts count must reflect only user-a's rows.
        expect(res.body.difficulty.t1.attempts).toBe(2);
        expect(res.body.difficulty.t2.attempts).toBe(1);

        // avg must be computed from user-a's rows only (50%, not 33%).
        expect(res.body.difficulty.t1.avgScore).toBe(50);
        expect(res.body.difficulty.t2.avgScore).toBe(100);
    });

    it('returns an empty difficulty map for a user with no attempts', async () => {
        seedAttempt({ userId: USER_A, testId: TEST_1, score: 5, totalQuestions: 10 });
        mockUser = { _id: USER_LONELY, isAdmin: false };

        const res = await request(app).get('/api/review/difficulty');
        expect(res.status).toBe(200);
        expect(res.body.difficulty).toEqual({});
    });

    it('does not aggregate across users even for admin callers (per-user is product intent)', async () => {
        seedAttempt({ userId: USER_ADMIN, testId: TEST_1, score: 10, totalQuestions: 10 });
        seedAttempt({ userId: USER_B, testId: TEST_1, score: 0, totalQuestions: 10 });

        mockUser = { _id: USER_ADMIN, isAdmin: true };
        const res = await request(app).get('/api/review/difficulty');
        expect(res.status).toBe(200);
        // Admin still sees only their own data on this endpoint.
        expect(res.body.difficulty.t1.attempts).toBe(1);
        expect(res.body.difficulty.t1.avgScore).toBe(100);
    });
});
