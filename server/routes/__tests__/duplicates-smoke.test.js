// Issue #15 — smoke test for server/routes/duplicates.js.
// Pins the auth + admin contract:
//   1. unauthenticated GET returns 401
//   2. authenticated non-admin GET returns 403
//   3. authenticated admin GET returns 200 with the expected envelope
// Monkey-patched models keep this Mongoose-free (pattern mirrored from
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

beforeAll(async () => {
    // /api/duplicates calls Test.find(filter, projection).lean().  Mock
    // returns an empty array so the route reaches the empty-clusters
    // happy path without exercising dedup against real text data.
    const TestModel = requireCJS('../../models/Test.js');
    TestModel.find = () => ({ lean: async () => [] });

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

    const router = requireCJS('../duplicates.js');
    const a = express();
    a.use('/api/duplicates', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => { mockUser = null; });

describe('GET /api/duplicates — auth + admin gate smoke (#15)', () => {
    it('returns 401 without authentication', async () => {
        const res = await request(app).get('/api/duplicates');
        expect(res.status).toBe(401);
    });

    it('returns 403 for an authenticated non-admin user', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/duplicates');
        expect(res.status).toBe(403);
    });

    it('returns 200 with empty clusters envelope for an admin', async () => {
        mockUser = { _id: 'admin1', isAdmin: true };
        const res = await request(app).get('/api/duplicates');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalQuestions', 0);
        expect(res.body).toHaveProperty('clusters');
        expect(Array.isArray(res.body.clusters)).toBe(true);
    });
});
