// Issue #435 — Sessions routes must short-circuit on invalid ObjectId
// in req.params.id and return 404 instead of letting a CastError leak
// through as 500.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

let app;

beforeAll(async () => {
    // Stub auth middleware so requireAuth lets the request through.
    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath,
        filename: authPath,
        loaded: true,
        exports: {
            requireAuth: (req, _res, next) => {
                req.user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isAdmin: false };
                next();
            },
            requireAdmin: (_req, _res, next) => next(),
            optionalAuth: (req, _res, next) => {
                req.user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isAdmin: false };
                next();
            },
        },
    };

    // Stub models — any DB call signals a regression (id should never reach the DB).
    const tsPath = requireCJS.resolve('../../models/TestSession.js');
    requireCJS.cache[tsPath] = {
        id: tsPath, filename: tsPath, loaded: true,
        exports: {
            findOneAndUpdate: async () => { throw new Error('should not reach DB for invalid ObjectId'); },
            findOne: async () => { throw new Error('should not reach DB for invalid ObjectId'); },
            create: async () => { throw new Error('should not reach DB for invalid ObjectId'); },
        },
    };
    const attemptPath = requireCJS.resolve('../../models/Attempt.js');
    requireCJS.cache[attemptPath] = {
        id: attemptPath, filename: attemptPath, loaded: true,
        exports: { create: async () => { throw new Error('should not reach DB for invalid ObjectId'); } },
    };
    const testModelPath = requireCJS.resolve('../../models/Test.js');
    requireCJS.cache[testModelPath] = {
        id: testModelPath, filename: testModelPath, loaded: true,
        exports: { findById: async () => { throw new Error('should not reach DB for invalid ObjectId'); } },
    };

    const router = requireCJS('../sessions.js');
    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
});

describe('Issue #435 — sessions routes ObjectId validation', () => {
    it('PATCH /api/sessions/not-a-valid-id returns 404, not 500', async () => {
        const res = await request(app)
            .patch('/api/sessions/not-a-valid-id')
            .send({ answers: [] });
        expect(res.status).toBe(404);
    });

    it('POST /api/sessions/abc/submit returns 404, not 500', async () => {
        const res = await request(app).post('/api/sessions/abc/submit').send({});
        expect(res.status).toBe(404);
    });

    it('DELETE /api/sessions/xyz returns 404, not 500', async () => {
        const res = await request(app).delete('/api/sessions/xyz');
        expect(res.status).toBe(404);
    });
});
