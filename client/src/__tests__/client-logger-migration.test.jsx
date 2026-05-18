// Issue #459 — production page-level error sites must call
// reportClientError() instead of console.error/console.warn so the
// failures funnel into the existing pino telemetry pipeline.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const clientRoot = resolve(__dirname, '..');

function readSrc(rel) {
    return readFileSync(resolve(clientRoot, rel), 'utf8');
}

const migratedFiles = [
    'pages/AdminBulkImport.jsx',
    'pages/AdminDuplicates.jsx',
    'pages/AdminFlags.jsx',
    'pages/CreateTest.jsx',
    'pages/Dashboard.jsx',
    'pages/EndlessMode.jsx',
    'pages/FailedQuestions.jsx',
    'pages/Home.jsx',
    'pages/TestTaker.jsx',
    'components/CommandPalette.jsx',
];

describe('Issue #459 — reportClientError migration', () => {
    it('globalErrorReporter exports reportClientError', () => {
        const src = readSrc('utils/globalErrorReporter.js');
        expect(src).toMatch(/export\s+function\s+reportClientError\s*\(/);
    });

    for (const rel of migratedFiles) {
        it(`${rel} imports reportClientError`, () => {
            const src = readSrc(rel);
            expect(src).toMatch(/reportClientError/);
        });

        it(`${rel} has no remaining console.error / console.warn calls`, () => {
            const src = readSrc(rel);
            expect(src).not.toMatch(/console\.(error|warn)\s*\(/);
        });
    }
});
