// Issue #484 — helmet HSTS config must match Caddy (1y + includeSubDomains
// + preload) so /api/* responses don't silently downgrade.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #484 — helmet HSTS explicit config', () => {
    it('declares an hsts block inside helmet({...}) with 1y maxAge', () => {
        expect(src).toMatch(/hsts:\s*\{[\s\S]{0,200}maxAge:\s*31536000/);
    });

    it('includeSubDomains explicit true', () => {
        expect(src).toMatch(/hsts:\s*\{[\s\S]{0,200}includeSubDomains:\s*true/);
    });

    it('preload explicit true (matches Caddy #468)', () => {
        expect(src).toMatch(/hsts:\s*\{[\s\S]{0,200}preload:\s*true/);
    });
});
