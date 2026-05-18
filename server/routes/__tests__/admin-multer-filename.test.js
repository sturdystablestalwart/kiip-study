// Issue #451 — multer storage filename must use crypto.randomUUID()
// and a mime-derived extension allowlist.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'admin.js'), 'utf8');

describe('Issue #451 — multer filename uuid + mime allowlist', () => {
    it('does not use Date.now() + Math.random() suffix anywhere', () => {
        expect(src).not.toMatch(/Math\.round\(Math\.random\(\)\s*\*\s*1E9\)/);
    });

    it('uses crypto.randomUUID() in both multer filename callbacks', () => {
        const filenameCallbacks = src.match(/filename:\s*\(req,\s*file,\s*cb\)[\s\S]*?\}/g) || [];
        expect(filenameCallbacks.length).toBeGreaterThanOrEqual(2);
        for (const cb of filenameCallbacks) {
            expect(cb).toMatch(/crypto\.randomUUID\(\)/);
        }
    });

    it('extension is derived from file.mimetype, not from originalname', () => {
        const filenameCallbacks = src.match(/filename:\s*\(req,\s*file,\s*cb\)[\s\S]*?\}/g) || [];
        for (const cb of filenameCallbacks) {
            expect(cb).not.toMatch(/path\.extname\(file\.originalname\)/);
            expect(cb).toMatch(/MIME_TO_EXT_(DOC|IMG)\[file\.mimetype\]/);
        }
    });
});
