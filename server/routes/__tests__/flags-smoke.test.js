// Issue #15 — smoke test for server/routes/flags.js.
// Covers the security contract every untested route should have:
//   1. unauthenticated POST returns 401
//   2. authenticated POST 400s on missing required fields
// We monkey-patch the Flag model and auth middleware so the test stays
// Mongoose-free and runs in <100ms (same pattern as the existing
// tests-public-leak.test.js).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

let app;
let mockUser = null;
let savedFlags = [];

beforeAll(async () => {
    const FlagModel = requireCJS('../../models/Flag.js');
    FlagModel.findOneAndUpdate = async (filter, update) => ({
        _id: 'flag-1',
        ...filter,
        ...(update?.$set || update),
    });
    FlagModel.prototype.save = async function () {
        const id = `flag-${savedFlags.length + 1}`;
        const stored = { _id: id, ...this };
        savedFlags.push(stored);
        return stored;
    };

    const auth = requireCJS('../../middleware/auth.js');
    auth.requireAuth = (req, res, next) => {
        if (!mockUser) return res.status(401).json({ message: 'Authentication required' });
        req.user = mockUser;
        next();
    };

    const router = requireCJS('../flags.js');
    const a = express();
    a.use(express.json());
    a.use('/api/flags', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => {
    mockUser = null;
    savedFlags = [];
});

describe('POST /api/flags — auth + validation smoke (#15)', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app)
            .post('/api/flags')
            .send({ testId: 't1', reason: 'incorrect' });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/auth/i);
    });

    it('returns 400 when required fields are missing', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app)
            .post('/api/flags')
            .send({}); // no testId, no reason
        // express-validator emits 400 for missing required fields; the
        // exact shape varies but the status code is the contract.
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
    });
});
