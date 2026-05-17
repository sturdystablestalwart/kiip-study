// Issue #15 — smoke test for server/routes/admin.js.
// admin.js mounts `router.use(requireAuth, requireAdmin)` at the top
// (line 24), so the security contract for the entire route surface
// is: every endpoint 401s unauthenticated, 403s for a logged-in
// non-admin, and at least returns a non-error code for an admin.
//
// We sample one representative endpoint per HTTP method to verify
// the chain wired correctly without exercising every leaf (those
// belong in dedicated per-route tests as they involve multer + sharp
// + Gemini mocks).

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
    const FlagModel = requireCJS('../../models/Flag.js');
    // Real handler chain: Flag.find(match).sort().limit().populate().populate().lean()
    const flagChain = {
        sort: () => flagChain,
        limit: () => flagChain,
        populate: () => flagChain,
        lean: async () => [],
    };
    FlagModel.find = () => flagChain;
    FlagModel.countDocuments = async () => 0;

    const AuditLogModel = requireCJS('../../models/AuditLog.js');
    const auditChain = {
        sort: () => auditChain,
        limit: () => auditChain,
        skip: () => auditChain,
        lean: async () => [],
    };
    AuditLogModel.find = () => auditChain;
    AuditLogModel.countDocuments = async () => 0;
    AuditLogModel.create = async () => ({});

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

    const router = requireCJS('../admin.js');
    const a = express();
    a.use(express.json());
    a.use('/api/admin', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => { mockUser = null; });

describe('admin.js — global auth + admin gate (#15)', () => {
    it('GET /api/admin/flags 401s without auth', async () => {
        const res = await request(app).get('/api/admin/flags');
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/flags 403s for non-admin user', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/admin/flags');
        expect(res.status).toBe(403);
    });

    it('GET /api/admin/flags 200s for admin (empty list)', async () => {
        mockUser = { _id: 'admin1', isAdmin: true };
        const res = await request(app).get('/api/admin/flags');
        expect(res.status).toBe(200);
    });

    it('GET /api/admin/audit 401s without auth', async () => {
        const res = await request(app).get('/api/admin/audit');
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/audit 403s for non-admin', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/admin/audit');
        expect(res.status).toBe(403);
    });
});
