// Issue #450 — PATCH /api/admin/tests/:id audit log records the
// field-level diff (changedFields + before/after question counts).

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
let lastAuditDetails;

beforeEach(async () => {
    lastAuditDetails = null;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: true }; next(); },
            requireAdmin: (_r, _s, next) => next(),
            optionalAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: true }; next(); },
        },
    };

    const existing = {
        _id: TEST_ID,
        title: 'old title',
        description: 'old desc',
        level: '2',
        unitNumber: 1,
        questions: [{ text: 'q1', type: 'mcq-single', options: [{ text: 'a', isCorrect: true }] }],
        save: async function () { return this; },
    };

    const testPath = requireCJS.resolve('../../models/Test.js');
    function TestCtor(doc) { Object.assign(this, doc); this.save = async () => ({ ...this, _id: TEST_ID }); }
    TestCtor.findById = async (id) => (id === TEST_ID ? existing : null);
    TestCtor.findByIdAndDelete = async () => existing;
    requireCJS.cache[testPath] = { id: testPath, filename: testPath, loaded: true, exports: TestCtor };

    const attemptPath = requireCJS.resolve('../../models/Attempt.js');
    requireCJS.cache[attemptPath] = {
        id: attemptPath, filename: attemptPath, loaded: true,
        exports: { deleteMany: async () => ({ deletedCount: 0 }) },
    };

    const auditPath = requireCJS.resolve('../../models/AuditLog.js');
    requireCJS.cache[auditPath] = {
        id: auditPath, filename: auditPath, loaded: true,
        exports: {
            create: async (doc) => { lastAuditDetails = doc?.details || null; return { _id: 'a' }; },
        },
    };

    const routerPath = requireCJS.resolve('../admin.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../admin.js');

    app = express();
    app.use(express.json());
    app.use('/api/admin', router);
});

async function flush() {
    await new Promise((r) => setImmediate(r));
}

describe('Issue #450 — PATCH /:id audit log records field-level diff', () => {
    it('records changedFields when level + questions change', async () => {
        const newQuestions = [
            { text: 'q1', type: 'mcq-single', options: [{ text: 'a', isCorrect: true }] },
            { text: 'q2', type: 'mcq-single', options: [{ text: 'b', isCorrect: true }] },
        ];
        const res = await request(app)
            .patch(`/api/admin/tests/${TEST_ID}`)
            .send({ level: '4', questions: newQuestions });
        expect(res.status).toBe(200);
        await flush();
        expect(lastAuditDetails).toBeTruthy();
        expect(lastAuditDetails.changedFields).toContain('level');
        expect(lastAuditDetails.changedFields).toContain('questions');
        expect(lastAuditDetails.questionsBefore).toBe(1);
        expect(lastAuditDetails.questionsAfter).toBe(2);
    });

    it('records empty changedFields when no fields changed', async () => {
        const res = await request(app).patch(`/api/admin/tests/${TEST_ID}`).send({});
        expect(res.status).toBe(200);
        await flush();
        expect(lastAuditDetails).toBeTruthy();
        expect(Array.isArray(lastAuditDetails.changedFields)).toBe(true);
        expect(lastAuditDetails.changedFields.length).toBe(0);
    });

    it('keeps the title in details (back-compat)', async () => {
        const res = await request(app)
            .patch(`/api/admin/tests/${TEST_ID}`)
            .send({ title: 'new title' });
        expect(res.status).toBe(200);
        await flush();
        expect(lastAuditDetails.title).toBe('new title');
        expect(lastAuditDetails.changedFields).toContain('title');
    });
});
