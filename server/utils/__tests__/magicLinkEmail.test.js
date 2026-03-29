import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Ensure SMTP is not configured so the console-log path is used
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
process.env.CLIENT_URL = 'http://localhost:5173';

const { sendMagicLinkEmail } = require('../magicLinkEmail.js');

describe('sendMagicLinkEmail', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('logs magic link to console when SMTP not configured', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await sendMagicLinkEmail('test@example.com', 'abc123token', 'en');

        const calls = consoleSpy.mock.calls.flat().join(' ');
        expect(calls).toContain('MAGIC LINK');
        expect(calls).toContain('test@example.com');
        expect(calls).toContain('abc123token');
    });

    it('includes correct link format with CLIENT_URL', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await sendMagicLinkEmail('user@test.com', 'mytoken', 'en');

        const calls = consoleSpy.mock.calls.flat().join(' ');
        expect(calls).toContain('http://localhost:5173/auth/verify?token=mytoken');
    });

    it('does not throw for any supported language', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        for (const lang of ['en', 'ko', 'ru', 'es']) {
            await expect(sendMagicLinkEmail('a@b.com', 'tok', lang)).resolves.not.toThrow();
        }
    });

    it('falls back to English for unknown language', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await sendMagicLinkEmail('a@b.com', 'tok', 'fr');
        // Should not throw and should still log
        expect(consoleSpy).toHaveBeenCalled();
    });
});
