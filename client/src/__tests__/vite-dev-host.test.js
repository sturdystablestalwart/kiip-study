// Issue #488 — vite dev server must default to localhost-only.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cfg = readFileSync(resolve(__dirname, '..', '..', 'vite.config.js'), 'utf8');

describe('Issue #488 — vite dev host gating', () => {
    it('host is gated behind VITE_HOST_ALL env var', () => {
        expect(cfg).toMatch(/host:\s*process\.env\.VITE_HOST_ALL\s*===\s*['"]true['"]/);
    });

    it('does not still hardcode host: true as a config value', () => {
        // Comment text may legitimately mention `host: true`; strip
        // line + block comments before checking actual config.
        const stripped = cfg
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\n]*/g, '');
        expect(stripped).not.toMatch(/host:\s*true\b/);
    });
});
