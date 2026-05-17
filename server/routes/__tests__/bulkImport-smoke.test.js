// Issue #15 — smoke test for server/routes/bulkImport.js.
// Both routes (POST /bulk-import, POST /bulk-import/confirm) require
// `requireAuth, requireAdmin` per CLAUDE.md.  Pinning the gate is the
// minimum-viable contract; the heavy lift (multer + xlsx/csv parsing
// + dedup) belongs in a richer follow-up that mocks the parser.

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

    const router = requireCJS('../bulkImport.js');
    const a = express();
    a.use(express.json());
    a.use('/api', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => { mockUser = null; });

describe('bulkImport.js — auth + admin gate smoke (#15)', () => {
    it('POST /api/bulk-import 401s without auth', async () => {
        const res = await request(app).post('/api/bulk-import');
        expect(res.status).toBe(401);
    });

    it('POST /api/bulk-import 403s for non-admin', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).post('/api/bulk-import');
        expect(res.status).toBe(403);
    });

    it('POST /api/bulk-import/confirm 401s without auth', async () => {
        const res = await request(app)
            .post('/api/bulk-import/confirm')
            .send({ previewId: 'abc' });
        expect(res.status).toBe(401);
    });

    it('POST /api/bulk-import/confirm 403s for non-admin', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app)
            .post('/api/bulk-import/confirm')
            .send({ previewId: 'abc' });
        expect(res.status).toBe(403);
    });
});
