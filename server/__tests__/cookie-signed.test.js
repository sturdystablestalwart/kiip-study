// Issue #487 — JWT cookie now signed by cookie-parser.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = resolve(__dirname, '..');

const indexSrc = readFileSync(resolve(serverRoot, 'index.js'), 'utf8');
const authRouteSrc = readFileSync(resolve(serverRoot, 'routes', 'auth.js'), 'utf8');
const authMwSrc = readFileSync(resolve(serverRoot, 'middleware', 'auth.js'), 'utf8');

describe('Issue #487 — JWT cookie signing', () => {
    it('cookie-parser is constructed with a secret (COOKIE_SECRET fallback to JWT_SECRET)', () => {
        expect(indexSrc).toMatch(/cookieParser\(\s*COOKIE_SECRET\s*\)/);
        expect(indexSrc).toMatch(/COOKIE_SECRET\s*=\s*[\s\S]{0,200}JWT_SECRET/);
    });

    it('auth route sets signed: true in COOKIE_OPTIONS', () => {
        expect(authRouteSrc).toMatch(/COOKIE_OPTIONS\s*=\s*\{[\s\S]{0,400}signed:\s*true/);
    });

    it('requireAuth reads signedCookies first, falls back to req.cookies', () => {
        expect(authMwSrc).toMatch(/req\.signedCookies\?\.jwt\s*\|\|\s*req\.cookies\?\.jwt/);
    });

    it('magic-link verify reads signedCookies first, falls back to req.cookies', () => {
        expect(authRouteSrc).toMatch(/req\.signedCookies\?\.jwt\s*\|\|\s*req\.cookies\?\.jwt/);
    });
});
