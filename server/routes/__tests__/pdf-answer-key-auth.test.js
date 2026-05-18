// Issue #476 — GET /api/pdf/test/:id?variant=answerKey must be
// admin-only. Non-admin should see 403; blank variant must still
// work for any authenticated user; admin still gets answerKey.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

const TEST_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
let app;
let pdfStreamed;

function buildApp({ isAdmin }) {
    pdfStreamed = false;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isAdmin }; next(); },
            requireAdmin: (req, res, next) => req.user?.isAdmin ? next() : res.status(403).json({ message: 'Admin only' }),
            optionalAuth: (req, _r, next) => { req.user = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', isAdmin }; next(); },
        },
    };

    const testPath = requireCJS.resolve('../../models/Test.js');
    requireCJS.cache[testPath] = {
        id: testPath, filename: testPath, loaded: true,
        exports: {
            findById: (id) => ({ lean: async () => (id === TEST_ID ? { _id: TEST_ID, title: 'T', questions: [] } : null) }),
        },
    };

    const pdfGenPath = requireCJS.resolve('../../utils/pdfGenerator.js');
    requireCJS.cache[pdfGenPath] = {
        id: pdfGenPath, filename: pdfGenPath, loaded: true,
        exports: {
            // The real generateTestPdfWithTimeout drives `doc` to
            // emit content and eventually `doc.end()` (which flushes
            // the response). Our stub just terminates the doc so the
            // piped HTTP response completes.
            generateTestPdfWithTimeout: async (doc) => {
                pdfStreamed = true;
                doc.text('test');
                doc.end();
            },
            DEFAULT_PDF_TIMEOUT_MS: 30000,
        },
    };

    const routerPath = requireCJS.resolve('../pdf.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../pdf.js');

    app = express();
    app.use(express.json());
    app.use('/api/pdf', router);
}

describe('Issue #476 — answerKey variant is admin-only', () => {
    it('non-admin GET /api/pdf/test/:id?variant=answerKey → 403', async () => {
        buildApp({ isAdmin: false });
        const res = await request(app).get(`/api/pdf/test/${TEST_ID}?variant=answerKey`);
        expect(res.status).toBe(403);
        expect(pdfStreamed).toBe(false);
    });

    it('non-admin GET /api/pdf/test/:id?variant=blank → 200 (PDF streamed)', async () => {
        buildApp({ isAdmin: false });
        const res = await request(app).get(`/api/pdf/test/${TEST_ID}?variant=blank`);
        expect(res.status).toBe(200);
        expect(pdfStreamed).toBe(true);
    });

    it('non-admin GET /api/pdf/test/:id (no variant, defaults to blank) → 200', async () => {
        buildApp({ isAdmin: false });
        const res = await request(app).get(`/api/pdf/test/${TEST_ID}`);
        expect(res.status).toBe(200);
        expect(pdfStreamed).toBe(true);
    });

    it('admin GET /api/pdf/test/:id?variant=answerKey → 200 (PDF streamed)', async () => {
        buildApp({ isAdmin: true });
        const res = await request(app).get(`/api/pdf/test/${TEST_ID}?variant=answerKey`);
        expect(res.status).toBe(200);
        expect(pdfStreamed).toBe(true);
    });
});
