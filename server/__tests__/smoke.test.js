import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// ─── Module-load smoke test ───────────────────────────────────────────────
//
// Regression net for parse-time / load-time failures in server modules.
// Background: classifier.js shipped with a duplicate `const result` declaration
// (issue #104), which made `require('./classifier')` throw SyntaxError at
// import time and silently broke every admin generate route, autoImporter,
// and migrateLegacyTests.
//
// This test require()'s every .js file under server/{utils,routes,middleware,
// models} and asserts no throw. Any future SyntaxError, duplicate declaration,
// missing dependency, or load-time exception is caught here at the cheapest
// possible level — well before integration tests.
//
// We do NOT mock the modules: real require() is what the production server
// runs at boot, so real require() is what we exercise.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Minimal env so modules that read env at load time don't fail. These are
// placeholders only — no module actually contacts the network during require().
//   - JWT_SECRET: server/middleware/auth.js hard-throws if unset.
//   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: passport-google-oauth20 throws
//     "OAuth2Strategy requires a clientID option" when its Strategy is
//     constructed at load time in server/routes/auth.js.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-jwt-secret-32chars-min!!';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'smoke-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'smoke-test-client-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const SERVER_ROOT = path.resolve(__dirname, '..');
const SCOPED_DIRS = ['utils', 'routes', 'middleware', 'models'];

function listJsFiles(dir) {
    const abs = path.join(SERVER_ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs)
        .filter(f => f.endsWith('.js'))
        .map(f => ({ rel: `${dir}/${f}`, abs: path.join(abs, f) }));
}

const allModules = SCOPED_DIRS.flatMap(listJsFiles);

describe('server module-load smoke test', () => {
    it('discovers server source modules', () => {
        // Sanity guard — if we discover zero files something is wrong with the
        // path resolution and the rest of the suite would be a no-op.
        expect(allModules.length).toBeGreaterThan(0);
    });

    // One sub-test per file so a single broken module produces a single
    // localised failure rather than crashing the whole describe block.
    for (const { rel, abs } of allModules) {
        it(`requires ${rel} without throwing`, () => {
            expect(() => require(abs)).not.toThrow();
        });
    }
});
