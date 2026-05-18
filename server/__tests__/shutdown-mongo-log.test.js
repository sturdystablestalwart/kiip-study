// Issue #445 — graceful shutdown must log mongoose.connection.close()
// errors via pino instead of swallowing them silently, and split the
// exit code (clean=0 / forced-timeout=1 / mongo-close-failed=2).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const src = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

describe('Issue #445 — shutdown logs and surfaces mongo close failures', () => {
    it('does not contain the empty-catch comment pattern', () => {
        expect(src).not.toMatch(/catch\s*\(\s*e\s*\)\s*\{\s*\/\*\s*ignore\s*\*\/\s*\}/);
    });

    it('logs mongo-close failure via pino in the shutdown path', () => {
        // The catch body must call logger.error and the surrounding log
        // text mentions mongo so future grep finds it.
        expect(src).toMatch(/logger\.error\([\s\S]{0,200}mongo/i);
    });

    it('exits with a distinct code on mongo-close failure', () => {
        // Either literal `process.exit(2)` or a ternary that picks 2 on failure.
        const literal = /process\.exit\(2\)/;
        const ternary = /process\.exit\([^)]*\?\s*2\s*:\s*0\)/;
        expect(literal.test(src) || ternary.test(src)).toBe(true);
    });
});
