// Issue #15 — smoke test for server/routes/pdf.js.
// Pins the universal `router.use(requireAuth)` gate the route declares
// at its top (line 37) — every PDF endpoint must 401 without a session.

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
    // Mocks never reached if auth gate works as documented; provide
    // them anyway as safety so a regression that bypasses auth surfaces
    // as a 404/500 rather than a hang.
    const TestModel = requireCJS('../../models/Test.js');
    TestModel.findById = () => ({ lean: async () => null });
    const AttemptModel = requireCJS('../../models/Attempt.js');
    AttemptModel.findById = () => ({ lean: async () => null });

    const auth = requireCJS('../../middleware/auth.js');
    auth.requireAuth = (req, res, next) => {
        if (!mockUser) return res.status(401).json({ message: 'Authentication required' });
        req.user = mockUser;
        next();
    };

    const router = requireCJS('../pdf.js');
    const a = express();
    a.use('/api/pdf', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => { mockUser = null; });

describe('PDF routes — auth gate smoke (#15)', () => {
    it('GET /api/pdf/test/:id returns 401 without authentication', async () => {
        const res = await request(app).get('/api/pdf/test/abc123?variant=blank');
        expect(res.status).toBe(401);
    });

    it('GET /api/pdf/attempt/:attemptId returns 401 without authentication', async () => {
        const res = await request(app).get('/api/pdf/attempt/att123?variant=student');
        expect(res.status).toBe(401);
    });
});
