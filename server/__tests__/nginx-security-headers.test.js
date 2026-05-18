// Issue #479 — client/nginx.conf must declare the same security
// headers as Caddy so a path that bypasses Caddy still ships them.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nginx = readFileSync(resolve(__dirname, '..', '..', 'client', 'nginx.conf'), 'utf8');

describe('Issue #479 — nginx.conf security headers', () => {
    const requiredHeaders = [
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Resource-Policy',
        'Content-Security-Policy',
    ];

    for (const h of requiredHeaders) {
        it(`declares add_header ${h}`, () => {
            const re = new RegExp(`add_header\\s+${h}\\s+"`);
            expect(nginx).toMatch(re);
        });
    }

    it('HSTS includes the preload directive', () => {
        expect(nginx).toMatch(/Strict-Transport-Security[^"]+"[^"]*preload/);
    });

    it('CSP includes frame-ancestors / base-uri / form-action defense', () => {
        expect(nginx).toMatch(/frame-ancestors 'none'/);
        expect(nginx).toMatch(/base-uri 'self'/);
        expect(nginx).toMatch(/form-action 'self'/);
    });

    it('uses `always` so headers appear on error responses too', () => {
        expect(nginx).toMatch(/add_header\s+Content-Security-Policy[\s\S]*?always/);
    });
});
