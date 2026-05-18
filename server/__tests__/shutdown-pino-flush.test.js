// Issue #502 — graceful shutdown must call logger.flush() before
// process.exit() so the async pino transport's buffer drains.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexSrc = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');
const loggerSrc = readFileSync(resolve(__dirname, '..', 'utils', 'logger.js'), 'utf8');

const requireCJS = createRequire(import.meta.url);

describe('Issue #502 — pino flush on shutdown', () => {
    it('logger exposes a flush() method', () => {
        const logger = requireCJS('../utils/logger.js');
        expect(typeof logger.flush).toBe('function');
        expect(loggerSrc).toMatch(/flush:\s*\(\)\s*=>\s*flushLogger\(\)/);
    });

    it('shutdown handler calls logger.flush() in both exit paths', () => {
        const matches = indexSrc.match(/logger\.flush\(\)/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});
