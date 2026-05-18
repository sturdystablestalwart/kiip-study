// Issue #463 — sessions/:id/submit duration must come from server-side
// wall clock (now - session.startedAt), not from the client-driven
// remainingTime field which a doctored client can freeze.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const SESSION_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TEST_ID = 'cccccccccccccccccccccccc';

let savedAttempt;
let app;
let sessionStatus;

function stubAll({ startedAt }) {
    sessionStatus = 'active';
    savedAttempt = null;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: USER_ID }; next(); },
            requireAdmin: (_r, _s, next) => next(),
            optionalAuth: (req, _r, next) => { req.user = { _id: USER_ID }; next(); },
        },
    };

    const tsPath = requireCJS.resolve('../../models/TestSession.js');
    requireCJS.cache[tsPath] = {
        id: tsPath, filename: tsPath, loaded: true,
        exports: {
            findOneAndUpdate: async (filter, update) => {
                if (filter && filter.status === 'active' && sessionStatus === 'active') {
                    sessionStatus = 'completed';
                    return {
                        _id: SESSION_ID,
                        userId: USER_ID,
                        testId: TEST_ID,
                        status: 'active',
                        mode: 'Practice',
                        // Attack vector: client-driven remainingTime still pristine
                        // (full 30 minutes), as if zero time has passed.
                        remainingTime: 30 * 60,
                        startedAt,
                        answers: [],
                    };
                }
                if (filter && filter.status === 'completed' && update && update.$set && update.$set.status === 'active') {
                    sessionStatus = 'active';
                    return { _id: SESSION_ID };
                }
                return null;
            },
            findOne: async () => null,
        },
    };

    const attemptPath = requireCJS.resolve('../../models/Attempt.js');
    requireCJS.cache[attemptPath] = {
        id: attemptPath, filename: attemptPath, loaded: true,
        exports: {
            create: async (doc) => { savedAttempt = doc; return { _id: 'dddddddddddddddddddddddd', ...doc }; },
        },
    };

    const testModelPath = requireCJS.resolve('../../models/Test.js');
    requireCJS.cache[testModelPath] = {
        id: testModelPath, filename: testModelPath, loaded: true,
        exports: { findById: async () => ({ _id: TEST_ID, questions: [] }) },
    };

    const routerPath = requireCJS.resolve('../sessions.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../sessions.js');

    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
}

describe('Issue #463 — session submit duration is server-authoritative wall clock', () => {
    it('5s-old session with frozen remainingTime persists duration in [4, 10]s (not 0)', async () => {
        const startedAt = new Date(Date.now() - 5_000);
        stubAll({ startedAt });
        const res = await request(app).post(`/api/sessions/${SESSION_ID}/submit`).send({});
        expect(res.status).toBe(200);
        expect(savedAttempt).toBeTruthy();
        expect(savedAttempt.duration).toBeGreaterThanOrEqual(4);
        expect(savedAttempt.duration).toBeLessThanOrEqual(10);
    });

    it('25-minute-old session with frozen remainingTime persists duration ≈ 1500s', async () => {
        const startedAt = new Date(Date.now() - 1500_000);
        stubAll({ startedAt });
        const res = await request(app).post(`/api/sessions/${SESSION_ID}/submit`).send({});
        expect(res.status).toBe(200);
        expect(savedAttempt.duration).toBeGreaterThanOrEqual(1495);
        expect(savedAttempt.duration).toBeLessThanOrEqual(1510);
    });

    it('multi-day-old session is clamped to MAX_SECONDS (4h)', async () => {
        const startedAt = new Date(Date.now() - 5 * 24 * 3600 * 1000);
        stubAll({ startedAt });
        const res = await request(app).post(`/api/sessions/${SESSION_ID}/submit`).send({});
        expect(res.status).toBe(200);
        expect(savedAttempt.duration).toBe(4 * 3600);
    });
});

describe('Issue #463 — source-level guarantee', () => {
    it('sessions.js no longer computes duration from session.remainingTime alone', () => {
        const src = readFileSync(resolve(__dirname, '..', 'sessions.js'), 'utf8');
        expect(src).not.toMatch(/const\s+duration\s*=\s*30\s*\*\s*60\s*-\s*session\.remainingTime/);
        expect(src).toMatch(/session\.startedAt/);
        expect(src).toMatch(/wallClockSeconds/);
    });
});
