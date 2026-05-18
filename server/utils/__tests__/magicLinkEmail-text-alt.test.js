// Issue #475 — magicLinkEmail must send multi-part MIME (text + html).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'magicLinkEmail.js'), 'utf8');

describe('Issue #475 — magicLinkEmail plain-text alternative', () => {
    it('sendMail payload includes a text: field built via buildText', () => {
        expect(src).toMatch(/sendMail\(\s*\{[\s\S]*?text:\s*buildText\([^)]*\)/);
    });

    it('buildText helper exists', () => {
        expect(src).toMatch(/function\s+buildText\(/);
    });

    it('textBodies declares en + ko + ru + es', () => {
        for (const lng of ['en', 'ko', 'ru', 'es']) {
            const re = new RegExp(`\\b${lng}:\\s*\\(\\s*link\\s*\\)\\s*=>`);
            expect(src).toMatch(re);
        }
    });

    it('plain-text body includes the raw link (no HTML tags)', () => {
        const blockMatch = src.match(/const\s+textBodies\s*=\s*\{[\s\S]*?\};/);
        expect(blockMatch).toBeTruthy();
        const block = blockMatch[0];
        expect(block).toMatch(/\$\{link\}/);
        expect(block).not.toMatch(/<a\b/);
    });
});
