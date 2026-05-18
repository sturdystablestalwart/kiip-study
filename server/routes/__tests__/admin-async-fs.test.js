// Issue #447 — admin.js request-path handlers must use fs/promises
// (readFile / unlink) instead of sync variants that block the event
// loop on multi-MB PDF uploads. Multer disk-storage destination
// callbacks (existsSync/mkdirSync) are allowed because the callback
// API is synchronous by contract.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'admin.js'), 'utf8');

describe('Issue #447 — admin.js uses async fs in request handlers', () => {
    it('does not call fs.readFileSync anywhere in the file', () => {
        expect(src).not.toMatch(/fs\.readFileSync\s*\(/);
    });

    it('does not call fs.unlinkSync anywhere in the file', () => {
        expect(src).not.toMatch(/fs\.unlinkSync\s*\(/);
    });

    it('imports fs/promises (or fsp alias)', () => {
        expect(src).toMatch(/require\(['"](?:node:)?fs\/promises['"]\)/);
    });
});
