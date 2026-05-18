// Issue #442 — every findOneAndUpdate / findByIdAndUpdate in
// production server code must pass `runValidators: true`, so Mongoose
// schema enums and length caps are enforced on updates (Mongoose
// disables update-time validators by default).

import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = resolve(__dirname, '..', '..');

const productionFiles = [
    'routes/auth.js',
    'routes/flags.js',
    'routes/sessions.js',
    'routes/admin.js',
];

function callBlocks(src) {
    const blocks = [];
    const re = /find(?:One|ById)AndUpdate\s*\(/g;
    let match;
    while ((match = re.exec(src)) !== null) {
        let depth = 0;
        const start = src.indexOf('(', match.index);
        let i = start;
        for (; i < src.length; i++) {
            const c = src[i];
            if (c === '(') depth++;
            else if (c === ')') {
                depth--;
                if (depth === 0) {
                    blocks.push({ start: match.index, src: src.slice(match.index, i + 1) });
                    break;
                }
            }
        }
    }
    return blocks;
}

describe('Issue #442 — runValidators on update-style queries', () => {
    for (const rel of productionFiles) {
        const abs = resolve(serverRoot, rel);
        const exists = !!statSync(abs, { throwIfNoEntry: false });
        if (!exists) continue;
        const src = readFileSync(abs, 'utf8');
        const blocks = callBlocks(src);

        for (const [idx, b] of blocks.entries()) {
            it(`${rel} call #${idx + 1} passes runValidators: true`, () => {
                expect(b.src).toMatch(/runValidators\s*:\s*true/);
            });
        }
    }
});
