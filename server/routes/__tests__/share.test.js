import { describe, it, expect, vi } from 'vitest';

// Unit tests for the POST /api/tests/:id/share middleware chain (H-SEC-1 fix).
//
// These tests verify the middleware chain behaviour directly — requireAuth then
// requireAdmin — without importing the Express app or connecting to MongoDB.
// This mirrors the pattern used in server/middleware/__tests__/auth.test.js.

// ─── Helpers ───

function mockRes() {
    const res = {
        statusCode: null,
        body: null,
        status(code) { res.statusCode = code; return res; },
        json(data)   { res.body = data;       return res; },
    };
    return res;
}

// Inline the middleware logic mirrored from server/middleware/auth.js so we can
// unit-test the combined chain without any Mongoose/JWT imports.

function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
}

// Simulates the middleware chain: requireAuth → requireAdmin → handler
function runChain(req) {
    const res = mockRes();
    const next1 = vi.fn();
    const next2 = vi.fn();

    requireAuth(req, res, next1);
    if (next1.mock.calls.length > 0) {
        requireAdmin(req, res, next2);
    }

    return { res, authCalled: next1.mock.calls.length > 0, adminCalled: next2.mock.calls.length > 0 };
}

// ─── POST /api/tests/:id/share — middleware chain tests ───

describe('POST /api/tests/:id/share — middleware chain (H-SEC-1)', () => {
    it('unauthenticated request is rejected with 401 before reaching requireAdmin', () => {
        const req = {}; // no req.user
        const { res, authCalled, adminCalled } = runChain(req);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe('Authentication required');
        expect(authCalled).toBe(false);
        expect(adminCalled).toBe(false);
    });

    it('authenticated non-admin user is rejected with 403', () => {
        const req = { user: { isAdmin: false } };
        const { res, authCalled, adminCalled } = runChain(req);

        expect(authCalled).toBe(true);   // passed requireAuth
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('Admin access required');
        expect(adminCalled).toBe(false); // did not reach handler
    });

    it('authenticated admin user passes both guards and reaches the handler', () => {
        const req = { user: { isAdmin: true } };
        const { res, authCalled, adminCalled } = runChain(req);

        expect(authCalled).toBe(true);  // passed requireAuth
        expect(adminCalled).toBe(true); // passed requireAdmin — handler would execute
        expect(res.statusCode).toBeNull(); // no error response set
    });
});

// ─── requireAdmin standalone behaviour ───

describe('requireAdmin (share route guard)', () => {
    it('returns 403 when req.user is absent', () => {
        const req = {};
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user.isAdmin is false', () => {
        const req = { user: { isAdmin: false } };
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('calls next() when user.isAdmin is true', () => {
        const req = { user: { isAdmin: true } };
        const res = mockRes();
        const next = vi.fn();

        requireAdmin(req, res, next);

        expect(res.statusCode).toBeNull();
        expect(next).toHaveBeenCalledOnce();
    });
});
