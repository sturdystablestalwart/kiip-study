// Regression test for #111 — admin image upload silently leaks the original
// file alongside the optimized .webp.
//
// Background: POST /api/admin/tests/upload (and /upload-multiple) accept an
// image via multer, save it to server/uploads/images/img-<id>.<ext>, then run
// `sharp(originalPath).webp(...).toFile(<base>-opt.webp)`. The original
// file must be removed after a successful conversion — otherwise disk usage
// grows ~2× the served bytes per upload. The error path must KEEP the
// original so the route can still serve something (and retry is possible).
//
// We don't use mongodb-memory-server (not in devDependencies) — instead we
// stub middleware/auth.js via require.cache so the admin router mounts with
// neutered auth, and we exercise sharp + multer + fs for real.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

// Required env so middleware/auth.js (loaded transitively) doesn't throw at
// import time even though we stub it out below.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-test-jwt-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const requireCJS = createRequire(import.meta.url);

// ─── Stub auth middleware BEFORE admin.js is required ────────────────────
// admin.js does `const { requireAuth, requireAdmin } = require('../middleware/auth')`
// at module load, so we must pre-seed require.cache with a pass-through stub
// keyed at the resolved auth path.
const authPath = requireCJS.resolve('../../middleware/auth.js');
const adminPath = requireCJS.resolve('../admin.js');

// Purge any prior cached copies so our stub takes precedence even if another
// test already loaded the real modules.
delete require.cache?.[authPath];
delete require.cache?.[adminPath];

// Synthesize a CJS module record matching Node's internal shape closely
// enough that `require()` returns our exports.
require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
        requireAuth: (req, _res, next) => { req.user = { _id: 'test-admin', isAdmin: true }; next(); },
        requireAdmin: (_req, _res, next) => next(),
        JWT_SECRET: 'test',
    },
    children: [],
    paths: [],
};

// Now require the admin router — it picks up our stubbed auth.
const adminRouter = requireCJS('../admin.js');

// ─── Test fixture: smallest valid PNG (1×1 transparent pixel) ────────────
// Source: a hand-built PNG. sharp can decode this.
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
);

// ─── App + uploads dir fixtures ──────────────────────────────────────────
let app;
const UPLOADS_DIR = path.join(path.dirname(adminPath), '..', 'uploads', 'images');

beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
});

// Track files present before each test so afterEach can clean up only the
// files this test created.
let preexisting;

beforeEach(() => {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    preexisting = new Set(fs.readdirSync(UPLOADS_DIR));
});

afterEach(() => {
    // Remove only files THIS test produced — never touch pre-existing files
    // (the dev server's real uploads may be sharing this directory).
    if (!fs.existsSync(UPLOADS_DIR)) return;
    for (const name of fs.readdirSync(UPLOADS_DIR)) {
        if (!preexisting.has(name)) {
            try { fs.unlinkSync(path.join(UPLOADS_DIR, name)); } catch { /* noop */ }
        }
    }
});

afterAll(() => {
    // Restore the real auth module for any subsequent test file that runs.
    delete require.cache?.[authPath];
    delete require.cache?.[adminPath];
});

// ─── The actual regression ──────────────────────────────────────────────

describe('POST /api/admin/tests/upload — disk leak (#111)', () => {
    it('deletes the original upload after successful .webp conversion', async () => {
        const res = await request(app)
            .post('/api/admin/tests/upload')
            .set('Origin', 'http://localhost:5173')
            .attach('image', TINY_PNG, { filename: 'leak-fixture.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        expect(res.body.filename).toMatch(/-opt\.webp$/);
        expect(res.body.mimetype).toBe('image/webp');

        // The optimized .webp must exist — that's the served artifact.
        const optimizedPath = path.join(UPLOADS_DIR, res.body.filename);
        expect(fs.existsSync(optimizedPath)).toBe(true);

        // Compute the original filename from the optimized one. The route
        // names the original `img-<unique>.<ext>` and the optimized
        // `img-<unique>-opt.webp`. Find any `img-*` file that is NOT the
        // optimized output we just got.
        const newFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => !preexisting.has(f));
        const originals = newFiles.filter((f) => f !== res.body.filename);

        // RED before the fix: a stray `img-<id>.png` remains here.
        // GREEN after the fix: only the .webp is left.
        expect(originals).toEqual([]);
    });
});

describe('POST /api/admin/tests/upload-multiple — disk leak (#111)', () => {
    it('deletes each original upload after its .webp conversion succeeds', async () => {
        const res = await request(app)
            .post('/api/admin/tests/upload-multiple')
            .set('Origin', 'http://localhost:5173')
            .attach('images', TINY_PNG, { filename: 'leak-fixture-a.png', contentType: 'image/png' })
            .attach('images', TINY_PNG, { filename: 'leak-fixture-b.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.images)).toBe(true);
        expect(res.body.images).toHaveLength(2);
        for (const img of res.body.images) {
            expect(img.filename).toMatch(/-opt\.webp$/);
            expect(img.mimetype).toBe('image/webp');
        }

        const optimizedNames = new Set(res.body.images.map((i) => i.filename));
        const newFiles = fs.readdirSync(UPLOADS_DIR).filter((f) => !preexisting.has(f));
        const originals = newFiles.filter((f) => !optimizedNames.has(f));

        expect(originals).toEqual([]);
    });
});
