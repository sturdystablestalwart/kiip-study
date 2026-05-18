// Issue #477 — pdf.js declares a per-user pdfLimiter so a single
// logged-in user can't loop PDF generation and monopolise the worker.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'pdf.js'), 'utf8');

describe('Issue #477 — PDF per-user rate limiter', () => {
    it('declares pdfLimiter via rateLimit({...})', () => {
        expect(src).toMatch(/const\s+pdfLimiter\s*=\s*[\s\S]*?rateLimit\(\s*\{/);
    });

    it('keys by req.user._id with IPv6-safe ipKeyGenerator fallback', () => {
        expect(src).toMatch(/keyGenerator:\s*\(req\)\s*=>\s*req\.user\?\._id\s*\?\s*String\(req\.user\._id\)\s*:\s*ipKeyGenerator\(req\.ip\)/);
    });

    it('mounts the limiter via router.use(pdfLimiter)', () => {
        expect(src).toMatch(/router\.use\(pdfLimiter\)/);
    });

    it('no-ops in NODE_ENV=test so existing pdf-smoke tests do not 429', () => {
        expect(src).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]test['"]/);
    });
});
