/**
 * Issue #9 — verify loadSecret prefers /run/secrets/<name> over the
 * env var when both exist, falls back cleanly when the file is absent,
 * trims trailing whitespace, and caches the result.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';

const requireCJS = createRequire(import.meta.url);

describe('loadSecret (#9)', () => {
    let loadSecret;
    let tmpDir;
    let origExistsSync;
    let origReadFileSync;

    beforeEach(() => {
        // Re-require fresh to reset the in-module cache.
        delete requireCJS.cache[requireCJS.resolve('../loadSecret')];
        loadSecret = requireCJS('../loadSecret');
        loadSecret.__resetCache();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loadsecret-'));

        // Stub fs to redirect /run/secrets/* to our temp dir so the
        // test works on Windows / macOS dev boxes that don't have
        // /run/secrets/.
        origExistsSync = fs.existsSync;
        origReadFileSync = fs.readFileSync;
        vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
            if (typeof p === 'string' && p.startsWith('/run/secrets/')) {
                return origExistsSync(path.join(tmpDir, path.basename(p)));
            }
            return origExistsSync(p);
        });
        vi.spyOn(fs, 'readFileSync').mockImplementation((p, ...rest) => {
            if (typeof p === 'string' && p.startsWith('/run/secrets/')) {
                return origReadFileSync(path.join(tmpDir, path.basename(p)), ...rest);
            }
            return origReadFileSync(p, ...rest);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('reads from /run/secrets/<lowercase-name> when present', () => {
        fs.writeFileSync(path.join(tmpDir, 'jwt_secret'), 'from-docker-secret');
        process.env.JWT_SECRET = 'from-env-var';
        expect(loadSecret('JWT_SECRET')).toBe('from-docker-secret');
    });

    test('falls back to process.env when the secret file is absent', () => {
        process.env.GEMINI_API_KEY = 'env-fallback';
        // No file in tmpDir, so existsSync returns false.
        expect(loadSecret('GEMINI_API_KEY')).toBe('env-fallback');
    });

    test('trims trailing whitespace from the secret file', () => {
        fs.writeFileSync(path.join(tmpDir, 'jwt_secret'), 'padded-secret\n  \n');
        expect(loadSecret('JWT_SECRET')).toBe('padded-secret');
    });

    test('caches the resolved value across calls', () => {
        fs.writeFileSync(path.join(tmpDir, 'jwt_secret'), 'first');
        expect(loadSecret('JWT_SECRET')).toBe('first');
        // Even after rewriting the file, the cached value persists.
        fs.writeFileSync(path.join(tmpDir, 'jwt_secret'), 'second');
        expect(loadSecret('JWT_SECRET')).toBe('first');
    });

    test('returns undefined when neither file nor env var is set', () => {
        delete process.env.TOTALLY_MISSING_SECRET;
        expect(loadSecret('TOTALLY_MISSING_SECRET')).toBeUndefined();
    });
});
