// Issue #470 — CI coverage steps must NOT carry continue-on-error,
// so a coverage threshold breach actually fails the PR check.
// @vitest/coverage-v8 must be declared in both workspace devDeps so
// `npm ci` guarantees the binary is present.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const ci = readFileSync(resolve(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
const clientPkg = JSON.parse(readFileSync(resolve(repoRoot, 'client', 'package.json'), 'utf8'));
const serverPkg = JSON.parse(readFileSync(resolve(repoRoot, 'server', 'package.json'), 'utf8'));

describe('Issue #470 — coverage steps hard-fail on regression', () => {
    it('no continue-on-error remains in the Coverage region of ci.yml', () => {
        const idx = ci.indexOf('Coverage — client');
        expect(idx).toBeGreaterThan(0);
        const region = ci.slice(idx, idx + 600);
        expect(region).not.toMatch(/continue-on-error:\s*true/);
    });

    it('@vitest/coverage-v8 is in client devDependencies', () => {
        expect(clientPkg.devDependencies?.['@vitest/coverage-v8']).toBeTruthy();
    });

    it('@vitest/coverage-v8 is in server devDependencies', () => {
        expect(serverPkg.devDependencies?.['@vitest/coverage-v8']).toBeTruthy();
    });
});
