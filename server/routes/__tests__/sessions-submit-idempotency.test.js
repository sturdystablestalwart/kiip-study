// Issue #436 — POST /api/sessions/:id/submit must atomically claim the
// session (active → completed) before creating the Attempt, so two
// concurrent submits create exactly ONE Attempt and the loser gets 404.
// On Attempt.create failure the session is rolled back to 'active'.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

const VALID_USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const VALID_SESSION_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const VALID_TEST_ID = 'cccccccccccccccccccccccc';

let attemptCreateCount;
let sessionStatus;
let app;
let forceCreateFail;

beforeEach(async () => {
    attemptCreateCount = 0;
    sessionStatus = 'active';
    forceCreateFail = false;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: VALID_USER_ID, isAdmin: false }; next(); },
            requireAdmin: (_r, _s, next) => next(),
            optionalAuth: (req, _r, next) => { req.user = { _id: VALID_USER_ID, isAdmin: false }; next(); },
        },
    };

    const tsPath = requireCJS.resolve('../../models/TestSession.js');
    requireCJS.cache[tsPath] = {
        id: tsPath, filename: tsPath, loaded: true,
        exports: {
            // Atomic claim: only the first call sees status:'active'; later
            // concurrent calls find nothing and return null.
            findOneAndUpdate: async (filter, update, _opts) => {
                if (filter && filter.status === 'active' && sessionStatus === 'active') {
                    sessionStatus = 'completed';
                    return {
                        _id: VALID_SESSION_ID,
                        userId: VALID_USER_ID,
                        testId: VALID_TEST_ID,
                        status: 'active',
                        mode: 'Practice',
                        remainingTime: 1500,
                        answers: [],
                        save: async function () { return this; },
                    };
                }
                // Rollback path: setting status:'active' from 'completed'.
                if (filter && filter.status === 'completed' && update && update.$set && update.$set.status === 'active') {
                    if (sessionStatus === 'completed') {
                        sessionStatus = 'active';
                        return { _id: VALID_SESSION_ID };
                    }
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
            create: async (doc) => {
                attemptCreateCount += 1;
                if (forceCreateFail) throw new Error('simulated db failure');
                return { _id: 'dddddddddddddddddddddddd', ...doc };
            },
        },
    };

    const testModelPath = requireCJS.resolve('../../models/Test.js');
    requireCJS.cache[testModelPath] = {
        id: testModelPath, filename: testModelPath, loaded: true,
        exports: { findById: async () => ({ _id: VALID_TEST_ID, questions: [] }) },
    };

    const routerPath = requireCJS.resolve('../sessions.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../sessions.js');

    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
});

describe('Issue #436 — atomic claim on session submit', () => {
    it('two concurrent /submit calls produce exactly 1 Attempt (loser gets 404)', async () => {
        const [a, b] = await Promise.all([
            request(app).post(`/api/sessions/${VALID_SESSION_ID}/submit`).send({}),
            request(app).post(`/api/sessions/${VALID_SESSION_ID}/submit`).send({}),
        ]);
        const statuses = [a.status, b.status].sort();
        expect(statuses).toEqual([200, 404]);
        expect(attemptCreateCount).toBe(1);
    });

    it('on Attempt.create failure the session is rolled back to active', async () => {
        forceCreateFail = true;
        const res = await request(app)
            .post(`/api/sessions/${VALID_SESSION_ID}/submit`)
            .send({});
        expect(res.status).toBe(500);
        expect(sessionStatus).toBe('active');
    });
});
