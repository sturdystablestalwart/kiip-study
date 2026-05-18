// Issue #437 — DELETE /api/admin/tests/:id must order the two deletes
// so a partial failure does not lose user data:
//   1. Delete the Test FIRST (so Attempts orphan only if step 2 crashes)
//   2. Write the AuditLog regardless (so we always have a record)
//   3. Delete the Attempts (orphans are recoverable via maintenance sweep)

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

let callOrder;
let attemptDeleteShouldFail;
let testDeleteShouldFail;
let auditLogCreated;
let app;

beforeEach(async () => {
    callOrder = [];
    attemptDeleteShouldFail = false;
    testDeleteShouldFail = false;
    auditLogCreated = false;

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
    requireCJS.cache[testPath] = {
        id: testPath, filename: testPath, loaded: true,
        exports: {
            findById: async (id) => (id === TEST_ID ? { _id: TEST_ID, title: 'Sample Test' } : null),
            findByIdAndDelete: async (_id) => {
                callOrder.push('test.delete');
                if (testDeleteShouldFail) throw new Error('simulated test delete failure');
                return { _id: TEST_ID, title: 'Sample Test' };
            },
        },
    };

    const attemptPath = requireCJS.resolve('../../models/Attempt.js');
    requireCJS.cache[attemptPath] = {
        id: attemptPath, filename: attemptPath, loaded: true,
        exports: {
            deleteMany: async (_filter) => {
                callOrder.push('attempts.deleteMany');
                if (attemptDeleteShouldFail) throw new Error('simulated attempts deleteMany failure');
                return { deletedCount: 5 };
            },
        },
    };

    const auditPath = requireCJS.resolve('../../models/AuditLog.js');
    requireCJS.cache[auditPath] = {
        id: auditPath, filename: auditPath, loaded: true,
        exports: {
            create: async (_doc) => {
                callOrder.push('audit.create');
                auditLogCreated = true;
                return { _id: 'audit-' + Date.now() };
            },
        },
    };

    const routerPath = requireCJS.resolve('../admin.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../admin.js');

    app = express();
    app.use(express.json());
    app.use('/api/admin', router);
});

describe('Issue #437 — DELETE /api/admin/tests/:id atomicity', () => {
    it('deletes the Test BEFORE the Attempts (order asserted)', async () => {
        const res = await request(app).delete(`/api/admin/tests/${TEST_ID}`);
        expect(res.status).toBe(200);
        const testIdx = callOrder.indexOf('test.delete');
        const attemptsIdx = callOrder.indexOf('attempts.deleteMany');
        expect(testIdx).toBeGreaterThanOrEqual(0);
        expect(attemptsIdx).toBeGreaterThanOrEqual(0);
        expect(testIdx).toBeLessThan(attemptsIdx);
        expect(auditLogCreated).toBe(true);
    });

    it('writes the AuditLog even when the Attempts deleteMany throws', async () => {
        attemptDeleteShouldFail = true;
        const res = await request(app).delete(`/api/admin/tests/${TEST_ID}`);
        expect(auditLogCreated).toBe(true);
        expect(res.status).toBeGreaterThanOrEqual(200);
    });

    it('when Test.findByIdAndDelete throws, no Attempts are deleted', async () => {
        testDeleteShouldFail = true;
        const res = await request(app).delete(`/api/admin/tests/${TEST_ID}`);
        expect(res.status).toBe(500);
        expect(callOrder).toContain('test.delete');
        expect(callOrder).not.toContain('attempts.deleteMany');
    });
});
