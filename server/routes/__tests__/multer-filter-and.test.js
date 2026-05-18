// Issue #499 — multer fileFilters must require BOTH a known mimetype
// AND a matching extension.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'admin.js'), 'utf8');

describe('Issue #499 — multer fileFilter AND shape', () => {
    it('documentFilter uses && between mimetype and extension check', () => {
        const filterMatch = src.match(/const documentFilter[\s\S]*?\};/);
        expect(filterMatch).toBeTruthy();
        const body = filterMatch[0];
        expect(body).toMatch(/allowedTypes\.includes\(file\.mimetype\)\s*&&\s*allowedExtensions\.includes\(ext\)/);
        expect(body).not.toMatch(/allowedTypes\.includes\(file\.mimetype\)\s*\|\|\s*allowedExtensions\.includes\(ext\)/);
    });

    it('imageFilter also requires both mimetype + extension', () => {
        const filterMatch = src.match(/const imageFilter[\s\S]*?\};/);
        expect(filterMatch).toBeTruthy();
        const body = filterMatch[0];
        expect(body).toMatch(/allowedTypes\.includes\(file\.mimetype\)\s*&&[\s\S]*?ALLOWED_IMAGE_EXTS\.includes\(ext\)/);
    });

    it('declares ALLOWED_IMAGE_EXTS list aligned with the mimetype allowlist', () => {
        expect(src).toMatch(/ALLOWED_IMAGE_EXTS\s*=\s*\[[\s\S]*?\.png[\s\S]*?\.webp/);
    });
});
