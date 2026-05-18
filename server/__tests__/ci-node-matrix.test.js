// Issue #469 — CI lint-build-test job must matrix Node 20 + 22 so
// a contributor on the newer LTS can't ship code that breaks for
// users on the oldest supported version.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ci = readFileSync(resolve(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8');

describe('Issue #469 — CI node-version matrix', () => {
    it('declares a node-version matrix containing 20 and 22', () => {
        expect(ci).toMatch(/strategy:[\s\S]*?matrix:[\s\S]*?node-version:[\s\S]*?20[\s\S]*?22/);
    });

    it('setup-node uses ${{ matrix.node-version }}', () => {
        expect(ci).toMatch(/node-version:\s*\$\{\{\s*matrix\.node-version\s*\}\}/);
    });

    it('lint-build-test job uses matrix interpolation, not a hardcoded version', () => {
        // The lint-build-test block must be the first one in the file
        // and must use ${{ matrix.node-version }} in its setup-node step.
        // (E2E job may still pin a single version — issue note allows that.)
        const start = ci.indexOf('lint-build-test:');
        const next = ci.indexOf('\n  e2e', start);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(next).toBeGreaterThan(start);
        const lbtBlock = ci.slice(start, next);
        expect(lbtBlock).toMatch(/\$\{\{\s*matrix\.node-version\s*\}\}/);
        const bareInLbt = lbtBlock.match(/^\s+node-version:\s+20\s*$/gm) || [];
        expect(bareInLbt).toEqual([]);
    });
});
