// Issue #438 — POST /api/admin/tests/import and PATCH /api/admin/tests/:id
// must reject malformed question shapes BEFORE save.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

let app;
let savedTest;

beforeEach(async () => {
    savedTest = null;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: true }; next(); },
            requireAdmin: (_r, _s, next) => next(),
            optionalAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: true }; next(); },
        },
    };

    const testPath = requireCJS.resolve('../../models/Test.js');
    function TestCtor(doc) {
        Object.assign(this, doc);
        this.save = async () => {
            savedTest = { ...doc, _id: TEST_ID };
            return savedTest;
        };
    }
    TestCtor.findById = async (id) => (id === TEST_ID ? {
        _id: TEST_ID,
        title: 'existing',
        questions: [],
        save: async function () { savedTest = { ...this }; return this; },
    } : null);
    TestCtor.findByIdAndDelete = async () => ({ _id: TEST_ID });
    requireCJS.cache[testPath] = { id: testPath, filename: testPath, loaded: true, exports: TestCtor };

    const attemptPath = requireCJS.resolve('../../models/Attempt.js');
    requireCJS.cache[attemptPath] = {
        id: attemptPath, filename: attemptPath, loaded: true,
        exports: { deleteMany: async () => ({ deletedCount: 0 }) },
    };

    const auditPath = requireCJS.resolve('../../models/AuditLog.js');
    requireCJS.cache[auditPath] = {
        id: auditPath, filename: auditPath, loaded: true,
        exports: { create: async () => ({ _id: 'audit' }) },
    };

    const routerPath = requireCJS.resolve('../admin.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../admin.js');

    app = express();
    app.use(express.json());
    app.use('/api/admin', router);
});

describe('Issue #438 — admin tests/import + PATCH question shape validation', () => {
    it('rejects POST /import when mcq-single option is missing isCorrect', async () => {
        const res = await request(app)
            .post('/api/admin/tests/import')
            .send({
                title: 'bad-test',
                questions: [
                    { text: 'q1', type: 'mcq-single', options: [{ text: 'a' }, { text: 'b' }] }
                ],
            });
        expect(res.status).toBe(400);
        expect(savedTest).toBeNull();
    });

    it('rejects POST /import when question type is unrecognised', async () => {
        const res = await request(app)
            .post('/api/admin/tests/import')
            .send({
                title: 'bad-test',
                questions: [{ text: 'q1', type: 'made-up-type' }],
            });
        expect(res.status).toBe(400);
        expect(savedTest).toBeNull();
    });

    it('rejects PATCH /:id when questions array is malformed', async () => {
        const res = await request(app)
            .patch(`/api/admin/tests/${TEST_ID}`)
            .send({
                questions: [{ text: 'q1', type: 'mcq-single', options: 'not-an-array' }],
            });
        expect(res.status).toBe(400);
        expect(savedTest).toBeNull();
    });

    it('accepts POST /import with a valid mcq-single question', async () => {
        const res = await request(app)
            .post('/api/admin/tests/import')
            .send({
                title: 'good-test',
                questions: [
                    {
                        text: 'q1',
                        type: 'mcq-single',
                        options: [
                            { text: 'a', isCorrect: true },
                            { text: 'b', isCorrect: false },
                        ],
                    },
                ],
            });
        expect(res.status).toBe(201);
        expect(savedTest).not.toBeNull();
    });
});
