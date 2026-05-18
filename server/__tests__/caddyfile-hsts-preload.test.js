// Issue #468 — Caddyfile HSTS header must include the `preload`
// directive so the domain is eligible for submission to
// https://hstspreload.org/.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const caddyfile = readFileSync(resolve(__dirname, '..', '..', 'Caddyfile'), 'utf8');

describe('Issue #468 — HSTS preload directive', () => {
    it('Strict-Transport-Security value contains preload', () => {
        expect(caddyfile).toMatch(/Strict-Transport-Security[^"]+"[^"]*preload/);
    });

    it('still keeps max-age=31536000 and includeSubDomains', () => {
        expect(caddyfile).toMatch(/Strict-Transport-Security[^"]+"[^"]*max-age=31536000/);
        expect(caddyfile).toMatch(/Strict-Transport-Security[^"]+"[^"]*includeSubDomains/);
    });
});
