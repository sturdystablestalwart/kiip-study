// Issue #446 — /uploads/images mounts express.static with
// `immutable: true`, which per RFC 8246 requires effectively-infinite
// max-age. Verify the maxAge is bumped to 1 year.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #446 — /uploads/images cache-control coherent with immutable', () => {
    it('does not declare maxAge: 7d alongside immutable: true', () => {
        const mismatched = /\/uploads\/images[\s\S]{0,300}maxAge:\s*['"]7d['"][\s\S]{0,200}immutable:\s*true/;
        expect(src).not.toMatch(mismatched);
    });

    it('uses a 1-year-equivalent maxAge for /uploads/images', () => {
        expect(src).toMatch(/\/uploads\/images[\s\S]{0,500}maxAge:\s*(?:['"](?:365d|1y)['"]|31536000)/);
    });
});
