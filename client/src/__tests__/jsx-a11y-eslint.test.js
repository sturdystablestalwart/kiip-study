// Issue #482 — eslint-plugin-jsx-a11y is installed in devDeps.
// Wiring it into eslint.config.js requires bypassing the project's
// local config-protection hook (see PR description), so this test
// only enforces that the dep is present in package.json.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));

describe('Issue #482 — jsx-a11y eslint plugin', () => {
    it('eslint-plugin-jsx-a11y is declared in client devDependencies', () => {
        expect(pkg.devDependencies?.['eslint-plugin-jsx-a11y']).toBeTruthy();
    });
});
