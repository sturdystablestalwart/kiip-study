/**
 * Regression for issue #32:
 * `requireEnv` must throw when any listed key is missing; `warnEnv`
 * must NOT throw but must log.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

describe('envValidate (#32)', () => {
    const saved = {};
    const keys = ['__TEST_REQ_A__', '__TEST_REQ_B__', '__TEST_WARN__'];

    beforeEach(() => {
        for (const k of keys) {
            saved[k] = process.env[k];
            delete process.env[k];
        }
        vi.resetModules();
    });

    afterEach(() => {
        for (const k of keys) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    });

    it('requireEnv throws listing every missing key', () => {
        const { requireEnv } = require('../envValidate');
        expect(() => requireEnv(['__TEST_REQ_A__', '__TEST_REQ_B__']))
            .toThrow(/Missing required env vars: __TEST_REQ_A__, __TEST_REQ_B__/);
    });

    it('requireEnv passes when every key is present', () => {
        process.env.__TEST_REQ_A__ = 'x';
        process.env.__TEST_REQ_B__ = 'y';
        const { requireEnv } = require('../envValidate');
        expect(() => requireEnv(['__TEST_REQ_A__', '__TEST_REQ_B__'])).not.toThrow();
    });

    it('warnEnv does not throw when keys are missing', () => {
        const { warnEnv } = require('../envValidate');
        expect(() => warnEnv(['__TEST_WARN__'], 'feature-x')).not.toThrow();
    });

    it('warnEnv does not throw when keys are present', () => {
        process.env.__TEST_WARN__ = 'set';
        const { warnEnv } = require('../envValidate');
        expect(() => warnEnv(['__TEST_WARN__'], 'feature-x')).not.toThrow();
    });
});
