// Issue #489 — logger.js must use pino.destination({ sync: false })
// in production and flush on SIGTERM/SIGINT/beforeExit.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'logger.js'), 'utf8');

describe('Issue #489 — logger async destination + flush', () => {
    it('declares pino.destination({ sync: false }) for production', () => {
        expect(src).toMatch(/pino\.destination\(\s*\{\s*sync:\s*false\s*\}\s*\)/);
    });

    it('gates sync vs async on NODE_ENV', () => {
        expect(src).toMatch(/NODE_ENV\s*===\s*['"]production['"][\s\S]{0,200}pino\.destination/);
    });

    it('registers flush on SIGTERM / SIGINT / beforeExit', () => {
        for (const ev of ['SIGTERM', 'SIGINT', 'beforeExit']) {
            const re = new RegExp(`process\\.on\\(\\s*['"]${ev}['"]\\s*,\\s*flushLogger\\s*\\)`);
            expect(src).toMatch(re);
        }
    });
});
