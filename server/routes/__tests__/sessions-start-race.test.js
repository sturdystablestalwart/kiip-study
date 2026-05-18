// Issue #453 — TestSession has a partial unique index on
// (userId, testId) where status='active'. When a concurrent create
// race happens, the route catches E11000 and serves the winning
// session as a resume.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

let app;
let store;
let nextId;

beforeEach(async () => {
    store = new Map();
    nextId = 0;

    const authPath = requireCJS.resolve('../../middleware/auth.js');
    requireCJS.cache[authPath] = {
        id: authPath, filename: authPath, loaded: true,
        exports: {
            requireAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: false }; next(); },
            requireAdmin: (_r, _s, next) => next(),
            optionalAuth: (req, _r, next) => { req.user = { _id: USER_ID, isAdmin: false }; next(); },
        },
    };

    const tsPath = requireCJS.resolve('../../models/TestSession.js');
    requireCJS.cache[tsPath] = {
        id: tsPath, filename: tsPath, loaded: true,
        exports: {
            findOne: async (query) => {
                for (const s of store.values()) {
                    if (String(s.userId) === String(query.userId) &&
                        String(s.testId) === String(query.testId) &&
                        s.status === query.status) {
                        return s;
                    }
                }
                return null;
            },
            create: async (doc) => {
                if (doc.status === 'active') {
                    for (const s of store.values()) {
                        if (String(s.userId) === String(doc.userId) &&
                            String(s.testId) === String(doc.testId) &&
                            s.status === 'active') {
                            const err = new Error('E11000 duplicate key');
                            err.code = 11000;
                            throw err;
                        }
                    }
                }
                nextId += 1;
                const id = String(nextId).padStart(24, '0');
                const created = { _id: id, ...doc };
                store.set(id, created);
                return created;
            },
        },
    };

    const testModelPath = requireCJS.resolve('../../models/Test.js');
    requireCJS.cache[testModelPath] = {
        id: testModelPath, filename: testModelPath, loaded: true,
        exports: {
            findById: () => ({
                select: () => ({ lean: async () => ({ _id: TEST_ID }) }),
            }),
        },
    };

    const routerPath = requireCJS.resolve('../sessions.js');
    delete requireCJS.cache[routerPath];
    const router = requireCJS('../sessions.js');

    app = express();
    app.use(express.json());
    app.use('/api/sessions', router);
});

describe('Issue #453 — duplicate-key on concurrent /start collapses to resume', () => {
    it('two parallel /start calls produce exactly one session (loser sees resumed: true)', async () => {
        const body = { testId: TEST_ID, mode: 'Practice' };
        const [a, b] = await Promise.all([
            request(app).post('/api/sessions/start').send(body),
            request(app).post('/api/sessions/start').send(body),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 201]);
        expect(store.size).toBe(1);
    });

    it('repeat /start by the same user returns resumed: true (existing path)', async () => {
        const body = { testId: TEST_ID, mode: 'Practice' };
        const first = await request(app).post('/api/sessions/start').send(body);
        expect(first.status).toBe(201);
        const second = await request(app).post('/api/sessions/start').send(body);
        expect(second.status).toBe(200);
        expect(second.body.resumed).toBe(true);
    });
});

describe('Issue #453 — model declares partial unique index', () => {
    it('TestSession.js declares { unique: true, partialFilterExpression: { status: "active" } }', () => {
        const src = readFileSync(resolve(__dirname, '..', '..', 'models', 'TestSession.js'), 'utf8');
        expect(src).toMatch(/unique:\s*true/);
        expect(src).toMatch(/partialFilterExpression:\s*\{\s*status:\s*['"]active['"]\s*\}/);
    });
});
