// Set required env vars BEFORE any module loads.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

// Issue #135 — shareRoutes was mounted twice (at /api/shared AND /api/tests),
// which silently created a second `GET /api/tests/:shareId` route currently
// shadowed by tests.js `GET /:id`. If anyone reorders mounts or removes the
// shadowing route, the public no-auth aggregation would accidentally be
// exposed under /api/tests.
//
// This test reproduces the production wiring at route level: it mounts the
// share router(s) and the tests router on the same Express app and asserts:
//   1. GET /api/shared/:shareId still works (public, no auth)
//   2. POST /api/tests/:id/share still works (admin)
//   3. GET /api/tests/:shareId does NOT route to the shareId handler — it must
//      go through the auth-required tests handler instead (proving no public
//      no-auth aggregation is reachable under /api/tests).

const requireCJS = createRequire(import.meta.url);

// ─── In-memory state ───
let mockUser = null;
const testStore = new Map();   // _id → test doc keyed by id
const shareStore = new Map();  // shareId → test doc

let app;

beforeAll(async () => {
    // 1) Monkey-patch Test model statics — share.js uses Test.aggregate +
    //    Test.findById; tests.js GET /:id uses Test.findById(...).lean().
    const TestModel = requireCJS('../../models/Test.js');

    TestModel.findById = function (id) {
        const doc = testStore.get(String(id)) || null;
        // Return an object that supports both chained .lean() and direct await
        // (share.js does `await Test.findById(...)`, tests.js does
        //  `await Test.findById(...).lean()`).
        const result = doc ? { ...doc } : null;
        const p = Promise.resolve(result);
        // attach .lean for the .lean() consumer
        p.lean = async () => result;
        // mimic Mongoose doc — share.js mutates test.shareId and calls .save()
        if (result) {
            result.save = async function () {
                testStore.set(String(this._id), { ...this });
                if (this.shareId) shareStore.set(this.shareId, { ...this });
                return this;
            };
        }
        return p;
    };

    TestModel.aggregate = async (pipeline) => {
        // share.js public GET pipeline: [{ $match: { shareId } }, { $limit: 1 }, { $project: ... }]
        const matchStage = pipeline.find((s) => s.$match);
        const wantedShareId = matchStage?.$match?.shareId;
        if (!wantedShareId) return [];
        const doc = shareStore.get(String(wantedShareId));
        if (!doc) return [];
        return [{
            _id: doc._id,
            title: doc.title,
            description: doc.description,
            level: doc.level,
            unitNumber: doc.unitNumber,
            section: doc.section,
            contentType: doc.contentType,
            shareId: doc.shareId,
            questionCount: Array.isArray(doc.questions) ? doc.questions.length : 0,
        }];
    };

    TestModel.find = function () {
        return { lean: async () => Array.from(testStore.values()) };
    };

    // 2) Monkey-patch auth middleware — bypass JWT verification, drive via mockUser
    const auth = requireCJS('../../middleware/auth.js');
    auth.requireAuth = (req, res, next) => {
        if (!mockUser) return res.status(401).json({ message: 'Authentication required' });
        req.user = mockUser;
        next();
    };
    auth.requireAdmin = (req, res, next) => {
        if (!req.user?.isAdmin) return res.status(403).json({ message: 'Admin access required' });
        next();
    };

    // 3) Load routers AFTER monkey-patching so they pick up the patched
    //    auth middleware via the shared module cache.
    const shareRoutes = requireCJS('../share.js');
    const { router: testRoutes } = requireCJS('../tests.js');

    const a = express();
    a.use(express.json());

    // Mirror server/index.js production wiring (post-fix):
    //   - tests router mounted at /api/tests
    //   - share router(s) split: public GET at /api/shared, admin POST at /api/tests
    a.use('/api/tests', testRoutes);

    if (shareRoutes && shareRoutes.publicRouter && shareRoutes.adminRouter) {
        // Pattern A (post-fix): { publicRouter, adminRouter }
        a.use('/api/shared', shareRoutes.publicRouter);
        a.use('/api/tests', shareRoutes.adminRouter);
    } else {
        // Pre-fix (legacy): single router exported — replicate the duplicate-mount footgun
        // so that the failing test demonstrates the issue if the refactor isn't applied.
        a.use('/api/shared', shareRoutes);
        a.use('/api/tests', shareRoutes);
    }

    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

function seedTest(id, { shareId, questions = [], ...extras } = {}) {
    const doc = {
        _id: id,
        title: extras.title || `Test ${id}`,
        questions,
        createdAt: new Date(),
        shareId: shareId || undefined,
        ...extras,
    };
    testStore.set(String(id), doc);
    if (shareId) shareStore.set(String(shareId), doc);
    return doc;
}

beforeEach(() => {
    testStore.clear();
    shareStore.clear();
    mockUser = null;
});

// ─── 1. Public GET /api/shared/:shareId still works ───

describe('GET /api/shared/:shareId — public path preserved', () => {
    it('returns the projected shared test without auth', async () => {
        seedTest('t-shared-1', {
            shareId: 'abcDEF1234',
            title: 'Shared Title',
            questions: [
                { type: 'mcq-single', text: 'Q1', options: [{ text: 'A', isCorrect: true }] },
                { type: 'mcq-single', text: 'Q2', options: [{ text: 'B', isCorrect: true }] },
            ],
        });

        const res = await request(app).get('/api/shared/abcDEF1234');
        expect(res.status).toBe(200);
        expect(res.body.shareId).toBe('abcDEF1234');
        expect(res.body.title).toBe('Shared Title');
        expect(res.body.questionCount).toBe(2);
        // Public projection must NOT leak full questions array
        expect(res.body.questions).toBeUndefined();
    });

    it('returns 404 for unknown shareId', async () => {
        const res = await request(app).get('/api/shared/nonexistent');
        expect(res.status).toBe(404);
    });
});

// ─── 2. Admin POST /api/tests/:id/share still works ───

describe('POST /api/tests/:id/share — admin path preserved', () => {
    it('requires authentication', async () => {
        seedTest('t-admin-1');
        mockUser = null;
        const res = await request(app)
            .post('/api/tests/t-admin-1/share')
            .set('Origin', 'http://localhost:5173')
            .send({});
        expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
        seedTest('t-admin-2');
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app)
            .post('/api/tests/t-admin-2/share')
            .set('Origin', 'http://localhost:5173')
            .send({});
        expect(res.status).toBe(403);
    });

    it('returns shareId for admin users', async () => {
        seedTest('t-admin-3', { title: 'Admin-Shared' });
        mockUser = { _id: 'admin1', isAdmin: true };
        const res = await request(app)
            .post('/api/tests/t-admin-3/share')
            .set('Origin', 'http://localhost:5173')
            .send({});
        expect(res.status).toBe(200);
        expect(typeof res.body.shareId).toBe('string');
        // Issue #65 — new shareIds must be 21 chars (~126 entropy bits).
        expect(res.body.shareId.length).toBe(21);
        expect(res.body.shareUrl).toContain(res.body.shareId);
    });
});

// ─── Module shape: share.js must export split routers (Pattern A) ───

describe('Issue #135 — share.js module must export split publicRouter + adminRouter', () => {
    it('exports { publicRouter, adminRouter } so callers cannot accidentally dual-mount', () => {
        const shareRoutes = requireCJS('../share.js');
        // The fix is to expose split routers. A single combined router invites
        // the dual-mount footgun from server/index.js:139-141.
        expect(shareRoutes).toHaveProperty('publicRouter');
        expect(shareRoutes).toHaveProperty('adminRouter');
        // Must be Express routers (functions with a .stack)
        expect(typeof shareRoutes.publicRouter).toBe('function');
        expect(typeof shareRoutes.adminRouter).toBe('function');
        expect(Array.isArray(shareRoutes.publicRouter.stack)).toBe(true);
        expect(Array.isArray(shareRoutes.adminRouter.stack)).toBe(true);
    });

    it('publicRouter only handles GET (no POST/PUT/DELETE)', () => {
        const { publicRouter } = requireCJS('../share.js');
        const methods = new Set();
        for (const layer of publicRouter.stack) {
            if (layer.route) {
                for (const m of Object.keys(layer.route.methods || {})) methods.add(m);
            }
        }
        expect(methods.has('get')).toBe(true);
        expect(methods.has('post')).toBe(false);
        expect(methods.has('put')).toBe(false);
        expect(methods.has('delete')).toBe(false);
    });

    it('adminRouter only handles POST (no GET/PUT/DELETE) — prevents accidental public-GET exposure under /api/tests', () => {
        const { adminRouter } = requireCJS('../share.js');
        const methods = new Set();
        for (const layer of adminRouter.stack) {
            if (layer.route) {
                for (const m of Object.keys(layer.route.methods || {})) methods.add(m);
            }
        }
        expect(methods.has('post')).toBe(true);
        expect(methods.has('get')).toBe(false);
    });
});

// ─── 3. GET /api/tests/:shareId must NOT route to the public share handler ───

describe('Issue #135 — GET /api/tests/:shareId must not invoke the public share handler', () => {
    it('does not expose the public no-auth aggregation under /api/tests', async () => {
        // Seed a test that has a shareId, but request it via /api/tests/<shareId>.
        // The shareId is NOT the test _id, so tests.js findById returns null
        // and the auth-required GET /:id handler should be the one responding.
        seedTest('t-by-id-only', {
            shareId: 'leakyShare01',
            questions: [{ type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] }],
        });

        // No mockUser — if the shadow route were reachable, this would return
        // 200 with the public aggregate (no auth required). After the fix the
        // only handler responding under /api/tests is the auth-gated GET /:id,
        // which must return 401.
        mockUser = null;
        const res = await request(app).get('/api/tests/leakyShare01');

        // The KEY assertion: the public no-auth aggregation MUST NOT be served
        // here. The auth-gated tests.js GET /:id must respond instead.
        expect(res.status).not.toBe(200);
        expect(res.body.shareId).toBeUndefined();
        expect(res.body.questionCount).toBeUndefined();
        // Concretely, with mockUser=null and tests.js requireAuth in place,
        // we expect 401.
        expect(res.status).toBe(401);
    });

    it('authenticated GET /api/tests/<shareId> still does not invoke the share handler', async () => {
        seedTest('t-by-id-only-2', {
            shareId: 'leakyShare02',
            questions: [{ type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] }],
        });

        mockUser = { _id: 'u1', isAdmin: false };
        // shareId is not a real test _id, so tests.js findById returns null → 404
        const res = await request(app).get('/api/tests/leakyShare02');

        // Must NOT be the share aggregate response (would have questionCount + shareId fields)
        expect(res.body.shareId).toBeUndefined();
        expect(res.body.questionCount).toBeUndefined();
        // tests.js GET /:id responds 404 when the _id doesn't match a test
        expect(res.status).toBe(404);
    });
});
