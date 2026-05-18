// Issue #467 — Caddyfile must declare Content-Security-Policy in its
// global header block so the SPA shell inherits the CSP that helmet
// only applies to Express routes.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const caddyfile = readFileSync(resolve(__dirname, '..', '..', 'Caddyfile'), 'utf8');

describe('Issue #467 — Caddyfile CSP', () => {
    it('declares Content-Security-Policy header', () => {
        expect(caddyfile).toMatch(/Content-Security-Policy\s+"[^"]+"/);
    });

    it("CSP value contains default-src 'self'", () => {
        expect(caddyfile).toMatch(/Content-Security-Policy[^"]+"[^"]*default-src 'self'/);
    });

    it('CSP value contains frame-ancestors / base-uri / form-action defense', () => {
        expect(caddyfile).toMatch(/frame-ancestors 'none'/);
        expect(caddyfile).toMatch(/base-uri 'self'/);
        expect(caddyfile).toMatch(/form-action 'self'/);
    });
});
