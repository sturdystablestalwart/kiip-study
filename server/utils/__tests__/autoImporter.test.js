// Resilience tests for server/utils/autoImporter.js (refs #222).
//
// Background: at server boot, autoImporter.js reads markdown/text files from
// additionalContext/tests/ and inserts them as Test docs. The classification
// step (Gemini-backed) can fail in CI where the API key is a placeholder.
// Previously, a classifier throw aborted the whole per-file try/catch and the
// Test was never saved. These tests pin the desired behavior: classifier
// failures must be non-fatal — the test still saves with default classification.
//
// We can't use mongodb-memory-server (not in devDependencies and we must not
// touch package.json), so we monkey-patch model statics + constructor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const requireCJS = createRequire(import.meta.url);

// ─── Per-test state ───
let savedDocs = [];
let originalTestsDir;

// Modules under test/mock — required lazily inside the per-test setup so
// each test gets a clean module instance and the classifier mock applies.
let TestModel;
let classifierModule;

// We do NOT require autoImporter here. Each test requires it AFTER the
// classifier mock is installed, because autoImporter destructures
// `classifyTest` at module-load time:
//     const { classifyTest } = require('./classifier');
// so the mock must be in place BEFORE that require runs.

function setupModules(classifyImpl) {
    // Purge any cached copies so the require below re-evaluates with the
    // freshly-patched classifier.
    const classifierPath = requireCJS.resolve('../classifier.js');
    const autoImporterPath = requireCJS.resolve('../autoImporter.js');
    delete require.cache?.[classifierPath];
    delete require.cache?.[autoImporterPath];

    classifierModule = requireCJS('../classifier.js');
    classifierModule.classifyTest = classifyImpl;

    // Require autoImporter NOW — its destructure will pick up the mock.
    return requireCJS('../autoImporter.js');
}

beforeEach(() => {
    // ─── Compute the path autoImporter will scan ───
    // autoImporter resolves __dirname + '../../additionalContext/tests' (relative
    // to server/utils). We can't override that path without changing the source,
    // so instead we point at the real path by ensuring it exists with our fixture
    // file, then clean up after.
    originalTestsDir = path.join(
        path.dirname(requireCJS.resolve('../autoImporter.js')),
        '..', '..', 'additionalContext', 'tests'
    );

    // ─── Patch Test model: replace findOne + prototype.save ───
    TestModel = requireCJS('../../models/Test.js');

    savedDocs = [];

    // Override findOne so dedup check always returns null (no existing doc)
    TestModel.findOne = vi.fn(async () => null);

    // Override prototype.save to capture the doc instead of touching Mongo
    TestModel.prototype.save = async function () {
        const plain = typeof this.toObject === 'function'
            ? this.toObject()
            : { ...this };
        savedDocs.push(plain);
        return plain;
    };
});

afterEach(() => {
    // Clean any temp fixture file we wrote into the real tests dir.
    try {
        const sentinel = path.join(originalTestsDir, '__autoimporter_test_fixture__.md');
        if (fs.existsSync(sentinel)) fs.unlinkSync(sentinel);
        // Try to remove the dir if WE created it and it's now empty.
        if (fs.existsSync(originalTestsDir)) {
            const remaining = fs.readdirSync(originalTestsDir);
            if (remaining.length === 0) {
                try { fs.rmdirSync(originalTestsDir); } catch { /* noop */ }
                try { fs.rmdirSync(path.dirname(originalTestsDir)); } catch { /* noop */ }
            }
        }
    } catch { /* cleanup best-effort */ }
    vi.restoreAllMocks();
});

// ─── Helper: write a fixture .md file into the real autoImporter scan dir ───
function writeFixture(filename, content) {
    fs.mkdirSync(originalTestsDir, { recursive: true });
    const filePath = path.join(originalTestsDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

// ─── A parseFunction that returns valid question data ───
function validParser() {
    return async (_content) => ({
        title: 'Resilience Fixture Test',
        questions: [
            {
                type: 'mcq-single',
                text: 'Q1',
                options: [
                    { text: 'A', isCorrect: true },
                    { text: 'B', isCorrect: false },
                ],
            },
        ],
    });
}

describe('autoImporter — classifier-failure resilience (#222)', () => {
    it('still saves the test when classifier throws', async () => {
        writeFixture('__autoimporter_test_fixture__.md', '# fixture body');

        const autoImportTests = setupModules(async () => {
            throw new Error('boom: gemini api key invalid');
        });

        await autoImportTests(validParser());

        expect(savedDocs.length).toBe(1);
        expect(savedDocs[0].title).toBe('Resilience Fixture Test');
        expect(savedDocs[0].source).toBe('auto-imported');
        // Questions preserved
        expect(savedDocs[0].questions.length).toBe(1);
        expect(savedDocs[0].questions[0].text).toBe('Q1');
        // Fallback classification: contentType falls back to the schema default
        // ('general') when classifier throws. level/unitNumber/section may be
        // null/undefined — what matters is the doc was saved, not skipped.
        expect(savedDocs[0].contentType).toBe('general');
    });

    it('saves with classification when classifier succeeds', async () => {
        writeFixture('__autoimporter_test_fixture__.md', '# fixture body');

        const autoImportTests = setupModules(async () => ({
            level: '2',
            unitNumber: 5,
            section: null,
            contentType: 'topic-drill',
        }));

        await autoImportTests(validParser());

        expect(savedDocs.length).toBe(1);
        expect(savedDocs[0].level).toBe('2');
        expect(savedDocs[0].contentType).toBe('topic-drill');
        expect(savedDocs[0].unitNumber).toBe(5);
    });

    it('does not throw when classifier rejects asynchronously', async () => {
        writeFixture('__autoimporter_test_fixture__.md', '# fixture body');

        const autoImportTests = setupModules(() =>
            Promise.reject(new Error('network error'))
        );

        // The whole call should resolve without throwing — this is the
        // key contract for boot-time auto-import.
        await expect(autoImportTests(validParser())).resolves.toBeUndefined();
        expect(savedDocs.length).toBe(1);
    });
});
