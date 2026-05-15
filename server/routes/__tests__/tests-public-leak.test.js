// Set required env vars BEFORE any module loads (auth.js throws on import without them).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);

// ─── In-memory state ───
let mockUser = null;
const testStore = new Map();   // id → test doc
let savedAttempts = [];        // captured via insertMany / save

let app;

beforeAll(async () => {
    // 1) Monkey-patch Test model
    const TestModel = requireCJS('../../models/Test.js');
    TestModel.find = function (match) {
        let arr;
        if (match && match._id && match._id.$in) {
            const ids = match._id.$in.map(String);
            arr = Array.from(testStore.values()).filter(t => ids.includes(String(t._id)));
        } else {
            arr = Array.from(testStore.values());
        }
        return { lean: async () => arr };
    };
    TestModel.findById = function (id) {
        const doc = testStore.get(String(id));
        return { lean: async () => (doc ? { ...doc } : null) };
    };
    TestModel.aggregate = async () => [];

    // 2) Monkey-patch Attempt model
    const AttemptModel = requireCJS('../../models/Attempt.js');
    // Constructor returns a "doc" with a .save() that records the data
    const OriginalAttempt = AttemptModel;
    // We can't replace AttemptModel itself because it's already bound in tests.js,
    // but we can replace prototype methods + static methods.
    OriginalAttempt.prototype.save = async function () {
        const id = `attempt-${savedAttempts.length + 1}`;
        // toObject if it's a real Mongoose doc, else plain copy
        const plain = typeof this.toObject === 'function' ? this.toObject() : { ...this };
        const stored = { _id: id, ...plain };
        savedAttempts.push(stored);
        return stored;
    };
    OriginalAttempt.find = () => ({
        sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    });
    OriginalAttempt.insertMany = async (docs) => {
        for (const d of docs) {
            savedAttempts.push({ _id: `attempt-${savedAttempts.length + 1}`, ...d });
        }
        return docs;
    };

    // 3) Monkey-patch the auth middleware
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

    // 4) Now (and only now) load the router, which `require`s the modules above
    const { router } = requireCJS('../tests.js');
    const a = express();
    a.use(express.json());
    a.use('/api/tests', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

function seedTest(id, questions, extras = {}) {
    const doc = {
        _id: id,
        title: extras.title || `Test ${id}`,
        questions,
        createdAt: new Date(),
        ...extras,
    };
    testStore.set(String(id), doc);
    return doc;
}

beforeEach(() => {
    testStore.clear();
    savedAttempts = [];
    mockUser = null;
});

// ─── Issue #107 — GET /api/tests/endless ───

describe('Issue #107 — GET /api/tests/endless must not leak answer keys', () => {
    it('strips isCorrect / acceptedAnswers / correctOrder / blanks.acceptedAnswers for authenticated users', async () => {
        seedTest('t1', [
            {
                type: 'mcq-single',
                text: 'Q1',
                options: [
                    { text: 'A', isCorrect: true },
                    { text: 'B', isCorrect: false },
                ],
                acceptedAnswers: ['fallback'],
                correctOrder: [0, 1],
                blanks: [{ acceptedAnswers: ['kor'] }],
            },
            {
                type: 'short-answer',
                text: 'Q2',
                acceptedAnswers: ['Seoul'],
            },
            {
                type: 'ordering',
                text: 'Q3',
                options: [{ text: 'x' }, { text: 'y' }],
                correctOrder: [1, 0],
            },
            {
                type: 'fill-in-the-blank',
                text: 'Q4 ___',
                blanks: [
                    { acceptedAnswers: ['Korea'] },
                    { acceptedAnswers: ['Seoul'] },
                ],
            },
        ]);

        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/tests/endless?limit=20');

        expect(res.status).toBe(200);
        expect(res.body.questions).toBeDefined();
        expect(res.body.questions.length).toBeGreaterThan(0);

        for (const q of res.body.questions) {
            expect(q).not.toHaveProperty('acceptedAnswers');
            expect(q).not.toHaveProperty('correctOrder');
            if (Array.isArray(q.options)) {
                for (const opt of q.options) {
                    if (opt && typeof opt === 'object') {
                        expect(opt).not.toHaveProperty('isCorrect');
                    }
                }
            }
            if (Array.isArray(q.blanks)) {
                for (const b of q.blanks) {
                    if (b && typeof b === 'object') {
                        expect(b).not.toHaveProperty('acceptedAnswers');
                    }
                }
            }
        }
    });

    it('preserves question text and option text so the UI can still render', async () => {
        seedTest('t2', [
            {
                type: 'mcq-single',
                text: 'Visible question',
                options: [
                    { text: 'Visible A', isCorrect: true },
                    { text: 'Visible B', isCorrect: false },
                ],
            },
        ]);
        mockUser = { _id: 'u2', isAdmin: false };
        const res = await request(app).get('/api/tests/endless?limit=10');
        expect(res.status).toBe(200);
        const q = res.body.questions[0];
        expect(q.text).toBe('Visible question');
        expect(q.options.map(o => o.text)).toEqual(['Visible A', 'Visible B']);
    });
});

// ─── Issue #108 — GET /api/tests/:id ───

describe('Issue #108 — GET /api/tests/:id must require auth and not leak answer keys', () => {
    it('returns 401 for unauthenticated requests', async () => {
        seedTest('t-private', [
            { type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] },
        ]);
        mockUser = null;
        const res = await request(app).get('/api/tests/t-private');
        expect(res.status).toBe(401);
    });

    it('returns 200 for authenticated non-admin but strips answer keys', async () => {
        seedTest('t-public', [
            {
                type: 'mcq-single',
                text: 'Q1',
                options: [
                    { text: 'A', isCorrect: true },
                    { text: 'B', isCorrect: false },
                ],
            },
            { type: 'short-answer', text: 'Q2', acceptedAnswers: ['Seoul'] },
        ]);
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/tests/t-public');
        expect(res.status).toBe(200);
        expect(res.body.title).toBeDefined();
        for (const q of res.body.questions) {
            expect(q).not.toHaveProperty('acceptedAnswers');
            expect(q).not.toHaveProperty('correctOrder');
            if (Array.isArray(q.options)) {
                for (const opt of q.options) {
                    if (opt && typeof opt === 'object') {
                        expect(opt).not.toHaveProperty('isCorrect');
                    }
                }
            }
        }
    });

    it('preserves answer keys for admin users (so the admin editor still works)', async () => {
        seedTest('t-admin', [
            {
                type: 'mcq-single',
                text: 'Q1',
                options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }],
            },
            { type: 'short-answer', text: 'Q2', acceptedAnswers: ['Seoul'] },
        ]);
        mockUser = { _id: 'admin1', isAdmin: true };
        const res = await request(app).get('/api/tests/t-admin');
        expect(res.status).toBe(200);
        expect(res.body.questions[0].options[0]).toHaveProperty('isCorrect', true);
        expect(res.body.questions[1].acceptedAnswers).toEqual(['Seoul']);
    });

    it('returns 404 when the test does not exist', async () => {
        mockUser = { _id: 'u1', isAdmin: false };
        const res = await request(app).get('/api/tests/does-not-exist');
        expect(res.status).toBe(404);
    });
});

// ─── Issue #109 — POST /api/tests/attempts/migrate ───

describe('Issue #109 — POST /api/tests/attempts/migrate must not trust client stats', () => {
    it('re-scores attempts server-side instead of trusting client-supplied score / totalQuestions', async () => {
        seedTest('t-mig', [
            {
                type: 'mcq-single',
                text: 'Q1',
                options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }],
            },
            {
                type: 'mcq-single',
                text: 'Q2',
                options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: true }],
            },
        ]);
        mockUser = { _id: 'u1', isAdmin: false };

        const res = await request(app)
            .post('/api/tests/attempts/migrate')
            .set('Origin', 'http://localhost:5173')
            .send({
                attempts: [
                    {
                        testId: 't-mig',
                        score: 9999,
                        totalQuestions: 9999,
                        answers: [
                            { questionIndex: 0, selectedOptions: [0], isCorrect: true },
                            { questionIndex: 1, selectedOptions: [0], isCorrect: true },
                        ],
                    },
                ],
            });

        expect(res.status).toBe(200);
        expect(savedAttempts).toHaveLength(1);
        const att = savedAttempts[0];
        expect(att.totalQuestions).toBe(2);
        expect(att.score).toBe(1);
        expect(String(att.userId)).toBe('u1');
    });

    it('clamps createdAt: cannot exceed Date.now()', async () => {
        seedTest('t-clamp', [
            { type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] },
        ]);
        mockUser = { _id: 'u1', isAdmin: false };

        const futureMs = Date.now() + 1000 * 60 * 60 * 24 * 365 * 10;
        const res = await request(app)
            .post('/api/tests/attempts/migrate')
            .set('Origin', 'http://localhost:5173')
            .send({
                attempts: [
                    {
                        testId: 't-clamp',
                        score: 1,
                        totalQuestions: 1,
                        createdAt: new Date(futureMs).toISOString(),
                        answers: [{ questionIndex: 0, selectedOptions: [0] }],
                    },
                ],
            });

        expect(res.status).toBe(200);
        const att = savedAttempts[0];
        const createdMs = +new Date(att.createdAt);
        expect(createdMs).toBeLessThanOrEqual(Date.now() + 1000);
        expect(createdMs).toBeLessThan(futureMs);
    });

    it('skips attempts whose testId does not resolve to a real test', async () => {
        seedTest('t-real', [
            { type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] },
        ]);
        mockUser = { _id: 'u1', isAdmin: false };

        const res = await request(app)
            .post('/api/tests/attempts/migrate')
            .set('Origin', 'http://localhost:5173')
            .send({
                attempts: [
                    { testId: 't-real', score: 1, totalQuestions: 1, answers: [{ questionIndex: 0, selectedOptions: [0] }] },
                    { testId: 'does-not-exist', score: 1, totalQuestions: 1, answers: [] },
                ],
            });

        expect(res.status).toBe(200);
        expect(savedAttempts).toHaveLength(1);
        expect(String(savedAttempts[0].testId)).toBe('t-real');
    });

    it('still caps migrated rows at 50', async () => {
        seedTest('t-cap', [
            { type: 'mcq-single', text: 'Q', options: [{ text: 'A', isCorrect: true }] },
        ]);
        mockUser = { _id: 'u1', isAdmin: false };

        const attempts = Array.from({ length: 75 }, () => ({
            testId: 't-cap',
            score: 1,
            totalQuestions: 1,
            answers: [{ questionIndex: 0, selectedOptions: [0] }],
        }));

        const res = await request(app)
            .post('/api/tests/attempts/migrate')
            .set('Origin', 'http://localhost:5173')
            .send({ attempts });

        expect(res.status).toBe(200);
        expect(savedAttempts.length).toBeLessThanOrEqual(50);
    });

    it('requires authentication', async () => {
        mockUser = null;
        const res = await request(app)
            .post('/api/tests/attempts/migrate')
            .set('Origin', 'http://localhost:5173')
            .send({ attempts: [] });
        expect(res.status).toBe(401);
    });
});
