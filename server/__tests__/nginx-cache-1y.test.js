// Issue #480 — nginx.conf static-asset Cache-Control must use ~1y
// (max-age=31536000) to match the `immutable` directive contract.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nginx = readFileSync(resolve(__dirname, '..', '..', 'client', 'nginx.conf'), 'utf8');

describe('Issue #480 — static-asset cache 1y', () => {
    it('Cache-Control uses 31536000 (1y) for content-hashed assets', () => {
        expect(nginx).toMatch(/Cache-Control[^"]+"public,\s*max-age=31536000,\s*immutable"/);
    });

    it('does not still set max-age=604800 (7d)', () => {
        expect(nginx).not.toMatch(/Cache-Control[^"]+"public,\s*max-age=604800/);
    });
});
