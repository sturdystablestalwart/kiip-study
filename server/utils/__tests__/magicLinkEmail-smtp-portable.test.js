// Issue #474 — magicLinkEmail.getTransporter must read SMTP_HOST,
// SMTP_PORT, SMTP_SECURE from env instead of hardcoding smtp.gmail.com.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'magicLinkEmail.js'), 'utf8');

describe('Issue #474 — SMTP host/port/secure configurable', () => {
    it('reads SMTP_HOST from env with smtp.gmail.com default', () => {
        expect(src).toMatch(/process\.env\.SMTP_HOST\s*\|\|\s*['"]smtp\.gmail\.com['"]/);
    });

    it('reads SMTP_PORT from env', () => {
        expect(src).toMatch(/process\.env\.SMTP_PORT/);
    });

    it('reads SMTP_SECURE from env (boolean)', () => {
        expect(src).toMatch(/process\.env\.SMTP_SECURE\s*===\s*['"]true['"]/);
    });

    it("does not still hardcode host: 'smtp.gmail.com' outside the || default fallback", () => {
        const lines = src.split('\n');
        const offending = lines.filter(l =>
            /host:\s*['"]smtp\.gmail\.com['"]/.test(l) && !/process\.env\.SMTP_HOST/.test(l)
        );
        expect(offending).toEqual([]);
    });
});
