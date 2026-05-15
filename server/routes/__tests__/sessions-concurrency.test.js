// Set required env vars BEFORE any module loads (auth.js throws on import without them).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

// ─── Issue #143 — Sessions PATCH must support optimistic concurrency ───
//
// Two tabs autosave a TestSession. Each PATCH sends full state. Last writer
// wins silently. Fix: accept optional `expectedLastSavedAt`. When present,
// the update must only succeed if the DB's lastSavedAt matches. On
// mismatch return 409 with `{ error: 'CONCURRENCY_CONFLICT', currentLastSavedAt }`.
// When absent, fall back to current behavior (back-compat). Response always
// includes the new lastSavedAt.

// ─── In-memory state ───
let mockUser = null;
// sessionStore keyed by stringified _id
let sessionStore = new Map();

let app;

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_1 = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const SESSION_1 = 'aaaaaaaaaaaaaaaaaaaaaaa2';

beforeAll(async () => {
    // Monkey-patch TestSession statics + instance save
    const TestSessionModel = requireCJS('../../models/TestSession.js');

    function decorate(doc) {
        if (!doc) return doc;
        // Provide .save() that bumps lastSavedAt — mimics the pre-fix code path.
        doc.save = async function () {
            this.lastSavedAt = new Date();
            sessionStore.set(String(this._id), { ...this, save: doc.save });
            return this;
        };
        return doc;
    }

    TestSessionModel.findOne = async function (query) {
        const all = Array.from(sessionStore.values());
        const match = all.find((s) => {
            if (query._id && String(query._id) !== String(s._id)) return false;
            if (query.userId && String(query.userId) !== String(s.userId)) return false;
            if (query.status && query.status !== s.status) return false;
            return true;
        });
        return decorate(match ? { ...match } : null);
    };

    TestSessionModel.findOneAndUpdate = async function (query, update, options) {
        const all = Array.from(sessionStore.values());
        const idx = all.findIndex((s) => {
            if (query._id && String(query._id) !== String(s._id)) return false;
            if (query.userId && String(query.userId) !== String(s.userId)) return false;
            if (query.status && query.status !== s.status) return false;
            if (query.lastSavedAt !== undefined) {
                const q = query.lastSavedAt instanceof Date ? query.lastSavedAt.getTime() : new Date(query.lastSavedAt).getTime();
                const cur = s.lastSavedAt instanceof Date ? s.lastSavedAt.getTime() : new Date(s.lastSavedAt).getTime();
                if (q !== cur) return false;
            }
            return true;
        });
        if (idx === -1) return null;

        const current = { ...all[idx] };
        const set = update.$set ? update.$set : update;
        for (const [k, v] of Object.entries(set)) {
            current[k] = v;
        }
        sessionStore.set(String(current._id), current);
        return options && options.new ? decorate({ ...current }) : decorate({ ...all[idx] });
    };

    // 2) Monkey-patch auth middleware
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

    // 3) Load router AFTER patches
    const router = requireCJS('../sessions.js');
    const a = express();
    a.use(express.json());
    a.use('/api/sessions', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => {
    sessionStore = new Map();
    mockUser = { _id: USER_A, isAdmin: false };
});

function seedSession({ _id = SESSION_1, userId = USER_A, testId = TEST_1, lastSavedAt }) {
    sessionStore.set(String(_id), {
        _id,
        userId,
        testId,
        mode: 'Practice',
        answers: [],
        currentQuestion: 0,
        remainingTime: 1800,
        status: 'active',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        lastSavedAt: lastSavedAt || new Date('2026-01-01T00:00:00Z'),
    });
}

describe('Issue #143 — PATCH /api/sessions/:id optimistic concurrency', () => {
    it('PATCH with matching expectedLastSavedAt succeeds and returns a new lastSavedAt', async () => {
        const T1 = new Date('2026-05-15T10:00:00Z');
        seedSession({ lastSavedAt: T1 });

        const res = await request(app)
            .patch(`/api/sessions/${SESSION_1}`)
            .set('Origin', 'http://localhost:5173')
            .send({
                answers: [{ questionIndex: 0, selectedOptions: [1] }],
                currentQuestion: 1,
                remainingTime: 1750,
                expectedLastSavedAt: T1.toISOString(),
            });

        expect(res.status).toBe(200);
        expect(res.body.session).toBeDefined();
        expect(res.body.session.lastSavedAt).toBeDefined();
        const newTs = new Date(res.body.session.lastSavedAt).getTime();
        expect(newTs).toBeGreaterThan(T1.getTime());
    });

    it('PATCH with stale expectedLastSavedAt returns 409 CONCURRENCY_CONFLICT with currentLastSavedAt', async () => {
        const T1 = new Date('2026-05-15T10:00:00Z');
        const T2 = new Date('2026-05-15T10:00:30Z');
        // Seed the session already advanced to T2 (peer tab already saved).
        seedSession({ lastSavedAt: T2 });

        const res = await request(app)
            .patch(`/api/sessions/${SESSION_1}`)
            .set('Origin', 'http://localhost:5173')
            .send({
                answers: [{ questionIndex: 0, selectedOptions: [2] }],
                expectedLastSavedAt: T1.toISOString(),
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('CONCURRENCY_CONFLICT');
        expect(res.body.currentLastSavedAt).toBeDefined();
        expect(new Date(res.body.currentLastSavedAt).getTime()).toBe(T2.getTime());
    });

    it('PATCH without expectedLastSavedAt still succeeds (back-compat)', async () => {
        const T1 = new Date('2026-05-15T10:00:00Z');
        seedSession({ lastSavedAt: T1 });

        const res = await request(app)
            .patch(`/api/sessions/${SESSION_1}`)
            .set('Origin', 'http://localhost:5173')
            .send({
                answers: [{ questionIndex: 0, selectedOptions: [1] }],
                currentQuestion: 1,
                remainingTime: 1750,
            });

        expect(res.status).toBe(200);
        expect(res.body.session).toBeDefined();
        expect(res.body.session.lastSavedAt).toBeDefined();
        const newTs = new Date(res.body.session.lastSavedAt).getTime();
        expect(newTs).toBeGreaterThanOrEqual(T1.getTime());
    });

    it('PATCH on non-existent session still returns 404 (auth + ownership unchanged)', async () => {
        // No seed.
        const res = await request(app)
            .patch(`/api/sessions/${SESSION_1}`)
            .set('Origin', 'http://localhost:5173')
            .send({ remainingTime: 1700 });

        expect(res.status).toBe(404);
    });

    it('PATCH without auth returns 401', async () => {
        mockUser = null;
        const res = await request(app)
            .patch(`/api/sessions/${SESSION_1}`)
            .set('Origin', 'http://localhost:5173')
            .send({ remainingTime: 1700 });
        expect(res.status).toBe(401);
    });
});
