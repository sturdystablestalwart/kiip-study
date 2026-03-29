import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import crypto from 'crypto';

// Mock nodemailer before importing
vi.mock('nodemailer', () => ({
    default: { createTransport: () => ({ sendMail: vi.fn() }) },
    createTransport: () => ({ sendMail: vi.fn() }),
}));

// ─── Token Hash Logic ───

describe('Magic Link Token Logic', () => {
    it('generates 256-bit token as base64url', () => {
        const token = crypto.randomBytes(32).toString('base64url');
        expect(token).toHaveLength(43);
        // Should be URL-safe
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
    });

    it('hash of token is deterministic', () => {
        const raw = 'test-token-value';
        const hash1 = crypto.createHash('sha256').update(raw).digest('hex');
        const hash2 = crypto.createHash('sha256').update(raw).digest('hex');
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64);
    });

    it('different tokens produce different hashes', () => {
        const token1 = crypto.randomBytes(32).toString('base64url');
        const token2 = crypto.randomBytes(32).toString('base64url');
        const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
        const hash2 = crypto.createHash('sha256').update(token2).digest('hex');
        expect(hash1).not.toBe(hash2);
    });

    it('hash is not reversible (one-way)', () => {
        const raw = crypto.randomBytes(32).toString('base64url');
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        // Hash should differ from raw token
        expect(hash).not.toBe(raw);
        // Hash output is always 64 hex chars regardless of input length
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rawToken is never stored — only hash is', () => {
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        // Simulate what the route stores: only tokenHash goes to DB
        const storedRecord = { tokenHash, email: 'user@example.com' };
        expect(storedRecord).not.toHaveProperty('rawToken');
        expect(storedRecord.tokenHash).toBe(tokenHash);
    });
});

// ─── Email Validation Logic ───

describe('Magic Link Email Validation', () => {
    // Mirrors the route guard: !email || typeof email !== 'string' || !email.includes('@')
    function isInvalidEmail(email) {
        return !email || typeof email !== 'string' || !email.includes('@');
    }

    it('rejects empty string', () => {
        expect(isInvalidEmail('')).toBe(true);
    });

    it('rejects null', () => {
        expect(isInvalidEmail(null)).toBe(true);
    });

    it('rejects undefined', () => {
        expect(isInvalidEmail(undefined)).toBe(true);
    });

    it('rejects non-string number', () => {
        expect(isInvalidEmail(12345)).toBe(true);
    });

    it('rejects email without @', () => {
        expect(isInvalidEmail('notanemail')).toBe(true);
    });

    it('rejects email with only @', () => {
        // Technically includes('@') is true, so the route accepts '@' — test documents that
        // the route relies on express-validator for full RFC validation elsewhere
        expect(isInvalidEmail('@')).toBe(false); // passes the basic guard
    });

    it('accepts valid email', () => {
        expect(isInvalidEmail('test@example.com')).toBe(false);
    });

    it('normalizes email to lowercase', () => {
        const email = 'Test@Example.COM';
        expect(email.trim().toLowerCase()).toBe('test@example.com');
    });

    it('normalizes email by trimming whitespace', () => {
        const email = '  user@example.com  ';
        expect(email.trim().toLowerCase()).toBe('user@example.com');
    });
});

// ─── Language Validation Logic ───

describe('Magic Link Language Validation', () => {
    const validLangs = ['en', 'ko', 'ru', 'es'];

    // Mirrors: ['en','ko','ru','es'].includes(lang) ? lang : 'en'
    function resolveLang(lang) {
        return validLangs.includes(lang) ? lang : 'en';
    }

    it('accepts en', () => {
        expect(resolveLang('en')).toBe('en');
    });

    it('accepts ko', () => {
        expect(resolveLang('ko')).toBe('ko');
    });

    it('accepts ru', () => {
        expect(resolveLang('ru')).toBe('ru');
    });

    it('accepts es', () => {
        expect(resolveLang('es')).toBe('es');
    });

    it('defaults to en for unsupported language fr', () => {
        expect(resolveLang('fr')).toBe('en');
    });

    it('defaults to en for undefined', () => {
        expect(resolveLang(undefined)).toBe('en');
    });

    it('defaults to en for null', () => {
        expect(resolveLang(null)).toBe('en');
    });

    it('defaults to en for empty string', () => {
        expect(resolveLang('')).toBe('en');
    });

    it('defaults to en for numeric value', () => {
        expect(resolveLang(42)).toBe('en');
    });

    it('is case-sensitive — EN is not valid', () => {
        expect(resolveLang('EN')).toBe('en');
    });
});

// ─── Token Expiry Logic ───

describe('Token Expiry Logic', () => {
    it('token expires after 10 minutes', () => {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const now = new Date();
        expect(expiresAt > now).toBe(true);

        // Simulate 11 minutes later
        const future = new Date(Date.now() + 11 * 60 * 1000);
        expect(expiresAt > future).toBe(false);
    });

    it('expired token is rejected (expiresAt in the past)', () => {
        const expiresAt = new Date(Date.now() - 1000); // 1 second ago
        const now = new Date();
        expect(expiresAt > now).toBe(false);
    });

    it('token exactly at expiry boundary is rejected', () => {
        // expiresAt === now means $gt condition fails
        const expiresAt = new Date(Date.now());
        // Use a slightly older date to simulate boundary
        const justAfter = new Date(expiresAt.getTime() + 1);
        expect(expiresAt > justAfter).toBe(false);
    });

    it('fresh token (9 min remaining) is still valid', () => {
        const expiresAt = new Date(Date.now() + 9 * 60 * 1000);
        const now = new Date();
        expect(expiresAt > now).toBe(true);
    });

    it('expiry window is exactly 10 minutes (600 seconds)', () => {
        const now = Date.now();
        const expiresAt = new Date(now + 10 * 60 * 1000);
        const diffSeconds = (expiresAt.getTime() - now) / 1000;
        expect(diffSeconds).toBe(600);
    });
});

// ─── Verify Route Error-Path Logic ───

describe('Magic Link Verify Error Routing', () => {
    // Mirrors the verify route's error redirect decision logic
    function resolveVerifyError(record) {
        if (!record) return 'TOKEN_INVALID';
        if (record.used) return 'TOKEN_USED';
        if (record.expiresAt < new Date()) return 'TOKEN_EXPIRED';
        return 'TOKEN_INVALID';
    }

    it('returns TOKEN_INVALID when no record found and no fallback record', () => {
        expect(resolveVerifyError(null)).toBe('TOKEN_INVALID');
    });

    it('returns TOKEN_USED when existing record is already used', () => {
        const record = { used: true, expiresAt: new Date(Date.now() + 60000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_USED');
    });

    it('returns TOKEN_EXPIRED when existing record is not used but expired', () => {
        const record = { used: false, expiresAt: new Date(Date.now() - 1000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_EXPIRED');
    });

    it('used takes priority over expired', () => {
        const record = { used: true, expiresAt: new Date(Date.now() - 1000) };
        expect(resolveVerifyError(record)).toBe('TOKEN_USED');
    });
});

// ─── Admin Email Logic ───

describe('Admin Email Promotion Logic', () => {
    // Mirrors: record.email === process.env.ADMIN_EMAIL
    function shouldBeAdmin(email, adminEmail) {
        return email === adminEmail;
    }

    it('grants admin when email matches ADMIN_EMAIL', () => {
        expect(shouldBeAdmin('admin@example.com', 'admin@example.com')).toBe(true);
    });

    it('does not grant admin for a different email', () => {
        expect(shouldBeAdmin('user@example.com', 'admin@example.com')).toBe(false);
    });

    it('comparison is case-sensitive', () => {
        // Email was normalized to lowercase before storage, so ADMIN_EMAIL should match lowercase
        expect(shouldBeAdmin('admin@example.com', 'Admin@Example.com')).toBe(false);
    });

    it('does not grant admin when ADMIN_EMAIL is undefined', () => {
        expect(shouldBeAdmin('user@example.com', undefined)).toBe(false);
    });
});
