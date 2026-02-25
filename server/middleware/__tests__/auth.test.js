import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'vitest-auth-secret-12345';
process.env.JWT_SECRET = TEST_SECRET;

// Import the real User model, then spy on findById
// Both this import and auth.js's require() resolve to the same module instance
const User = (await import('../../models/User.js')).default;
const findByIdSpy = vi.spyOn(User, 'findById');

const { requireAuth, requireAdmin } = await import('../auth.js');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

// ─── requireAuth ───

describe('requireAuth', () => {
  beforeEach(() => {
    findByIdSpy.mockReset();
  });

  it('returns 401 when no jwt cookie', async () => {
    const req = { cookies: {} };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when cookies is undefined', async () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired token', async () => {
    const expiredToken = jwt.sign({ userId: 'user123' }, TEST_SECRET, { expiresIn: '-1s' });

    const req = { cookies: { jwt: expiredToken } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token expired');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    const req = { cookies: { jwt: 'not-a-real-jwt' } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for token signed with wrong secret', async () => {
    const badToken = jwt.sign({ userId: 'user123' }, 'wrong-secret');

    const req = { cookies: { jwt: badToken } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user not found in database', async () => {
    const validToken = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, TEST_SECRET, { expiresIn: '1h' });
    findByIdSpy.mockResolvedValue(null);

    const req = { cookies: { jwt: validToken } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(findByIdSpy).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('User not found');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and sets req.user when token is valid', async () => {
    const fakeUser = { _id: 'user123', email: 'test@test.com', isAdmin: false };
    const validToken = jwt.sign({ userId: 'user123' }, TEST_SECRET, { expiresIn: '1h' });
    findByIdSpy.mockResolvedValue(fakeUser);

    const req = { cookies: { jwt: validToken } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBe(fakeUser);
    expect(res.statusCode).toBeNull();
  });
});

// ─── requireAdmin ───

describe('requireAdmin', () => {
  it('returns 403 when req.user is missing', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Admin access required');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', () => {
    const req = { user: { isAdmin: false } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user is admin', () => {
    const req = { user: { isAdmin: true } };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBeNull();
  });
});
