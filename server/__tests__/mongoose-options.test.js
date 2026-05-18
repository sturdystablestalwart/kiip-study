// Issue #495 — mongoose.connect options must include autoIndex
// false-in-prod and explicit retryWrites/retryReads.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #495 — mongoose.connect production options', () => {
    it('autoIndex is gated on NODE_ENV !== production', () => {
        expect(src).toMatch(/autoIndex:\s*process\.env\.NODE_ENV\s*!==\s*['"]production['"]/);
    });

    it('declares retryWrites: true explicitly', () => {
        expect(src).toMatch(/retryWrites:\s*true/);
    });

    it('declares retryReads: true explicitly', () => {
        expect(src).toMatch(/retryReads:\s*true/);
    });
});
