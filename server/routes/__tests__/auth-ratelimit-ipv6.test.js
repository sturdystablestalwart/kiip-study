// Issue #441 — every rateLimit() factory in this repo must pass an
// explicit `keyGenerator` that funnels req.ip through ipKeyGenerator()
// (or a user-bound key), so IPv6 /64-prefix rotation cannot bypass the
// bucket. The default key in express-rate-limit v8 is raw req.ip, which
// gives an attacker 2^64 distinct buckets on IPv6.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sources = {
    auth: readFileSync(resolve(__dirname, '..', 'auth.js'), 'utf8'),
    serverIndex: readFileSync(resolve(__dirname, '..', '..', 'index.js'), 'utf8'),
};

function rateLimitBlocks(src) {
    const blocks = [];
    const factoryRe = /rateLimit\(\s*\{/g;
    let match;
    while ((match = factoryRe.exec(src)) !== null) {
        let depth = 0;
        let i = src.indexOf('{', match.index);
        const start = i;
        for (; i < src.length; i++) {
            const c = src[i];
            if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) {
                    blocks.push(src.slice(start, i + 1));
                    break;
                }
            }
        }
    }
    return blocks;
}

describe('Issue #441 — every rateLimit() must declare a keyGenerator', () => {
    for (const [name, src] of Object.entries(sources)) {
        const blocks = rateLimitBlocks(src);

        it(`${name}.js declares at least one rateLimit(...) block`, () => {
            expect(blocks.length).toBeGreaterThan(0);
        });

        for (const [idx, block] of blocks.entries()) {
            it(`${name}.js rateLimit block #${idx + 1} has an explicit keyGenerator`, () => {
                expect(block).toMatch(/keyGenerator\s*:/);
            });
        }
    }
});
