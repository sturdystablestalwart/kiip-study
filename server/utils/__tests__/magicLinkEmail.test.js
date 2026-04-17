import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Ensure SMTP is not configured so the no-SMTP path is used
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
process.env.CLIENT_URL = 'http://localhost:5173';

const { sendMagicLinkEmail } = require('../magicLinkEmail.js');

describe('sendMagicLinkEmail', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns smtp-not-configured when SMTP not set', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await sendMagicLinkEmail('test@example.com', 'abc123token', 'en');
        expect(result).toEqual({ sent: false, reason: 'smtp-not-configured' });
    });

    it('does NOT log the token or verify URL when SMTP not configured', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        await sendMagicLinkEmail('user@test.com', 'mytoken', 'en');

        const allOutput = [
            ...warnSpy.mock.calls.flat(),
            ...logSpy.mock.calls.flat(),
        ].join(' ');
        expect(allOutput).not.toContain('mytoken');
        expect(allOutput).not.toContain('auth/verify');
    });

    it('does not throw for any supported language', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        for (const lang of ['en', 'ko', 'ru', 'es']) {
            await expect(sendMagicLinkEmail('a@b.com', 'tok', lang)).resolves.not.toThrow();
        }
    });

    it('falls back to English for unknown language without throwing', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await sendMagicLinkEmail('a@b.com', 'tok', 'fr');
        expect(result).toEqual({ sent: false, reason: 'smtp-not-configured' });
    });
});
