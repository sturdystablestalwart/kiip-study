// Set required env vars BEFORE any module loads.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRequire } from 'node:module';

// Issue #129 — GET /api/curriculum had:
//   - no Cache-Control header (clients re-fetched the full collection per page load)
//   - no try/catch (rejected promises crashed the route + leaked stack traces)
//   - no in-memory cache (every request hit MongoDB even though data only
//     changes on redeploy)
//
// These tests cover the fix: 1-hour Cache-Control header, in-memory cache with
// TTL (matching classifier.getTaxonomy's pattern), and safeError'd 500 path.

const requireCJS = createRequire(import.meta.url);

// ─── Fixture curriculum docs ───
const CURRICULUM_FIXTURE = [
    {
        level: '0',
        levelName: { ko: '한글', en: 'Hangul' },
        hours: 15,
        units: [
            { number: 1, titleKo: '자음과 모음', titleEn: 'Consonants & Vowels' },
        ],
    },
    {
        level: '1',
        levelName: { ko: '기초1', en: 'Basic 1' },
        hours: 100,
        units: [
            { number: 1, titleKo: '안녕하세요', titleEn: 'Hello' },
            { number: 2, titleKo: '저는 학생입니다', titleEn: "I'm a student" },
        ],
    },
];

let app;
let CurriculumModel;
let findSpy;

beforeAll(async () => {
    CurriculumModel = requireCJS('../../models/Curriculum.js');

    // Default mock: GET / does Curriculum.find({}).sort({ level: 1 }).lean();
    //               GET /:level does Curriculum.findOne({ level }).lean();
    CurriculumModel.find = function () {
        return {
            sort: () => ({
                lean: async () => CURRICULUM_FIXTURE.slice(),
            }),
        };
    };
    CurriculumModel.findOne = function (query) {
        const doc = CURRICULUM_FIXTURE.find((c) => c.level === query.level) || null;
        return { lean: async () => (doc ? { ...doc } : null) };
    };

    // Load the router AFTER patching the model.
    const router = requireCJS('../curriculum.js');
    const a = express();
    a.use(express.json());
    a.use('/api/curriculum', router);
    // eslint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => { res.status(500).json({ message: err.message }); });
    app = a;
});

beforeEach(() => {
    // Reset model spies and bust the module-scope cache before every test so
    // each spec starts from a clean slate.
    if (findSpy) findSpy.mockRestore();
    findSpy = vi.spyOn(CurriculumModel, 'find');

    // Public API to bust the cache during tests — also useful in prod if a
    // mutation route is ever introduced.
    const curriculumRoute = requireCJS('../curriculum.js');
    if (typeof curriculumRoute.__resetCache === 'function') {
        curriculumRoute.__resetCache();
    }
});

describe('Issue #129 — GET /api/curriculum cache + reliability', () => {
    it('returns the full curriculum on the happy path', async () => {
        const res = await request(app).get('/api/curriculum');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].level).toBe('0');
        expect(res.body[1].level).toBe('1');
    });

    it('sets Cache-Control: public, max-age=3600 on the successful response', async () => {
        const res = await request(app).get('/api/curriculum');
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=3600');
    });

    it('serves subsequent requests from in-memory cache (Curriculum.find called once)', async () => {
        const r1 = await request(app).get('/api/curriculum');
        const r2 = await request(app).get('/api/curriculum');
        const r3 = await request(app).get('/api/curriculum');

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r3.status).toBe(200);
        // Cache hit: 3 requests, 1 DB call.
        expect(findSpy).toHaveBeenCalledTimes(1);

        // Response body remains stable across cached requests.
        expect(r2.body).toEqual(r1.body);
        expect(r3.body).toEqual(r1.body);
    });

    it('busts the cache via __resetCache helper (e.g. after redeploy or test reset)', async () => {
        await request(app).get('/api/curriculum');
        await request(app).get('/api/curriculum');
        expect(findSpy).toHaveBeenCalledTimes(1);

        const curriculumRoute = requireCJS('../curriculum.js');
        curriculumRoute.__resetCache();

        await request(app).get('/api/curriculum');
        expect(findSpy).toHaveBeenCalledTimes(2);
    });

    it('returns 500 with a safeError-formatted body when Curriculum.find rejects (no stack leak, no crash)', async () => {
        // Force the next find to reject; route must not crash.
        findSpy.mockImplementationOnce(() => ({
            sort: () => ({
                lean: async () => { throw new Error('mongo connection lost'); },
            }),
        }));

        const res = await request(app).get('/api/curriculum');
        expect(res.status).toBe(500);
        // safeError returns "<prefix>: <message>" in non-prod; we just want a
        // string-shaped error field, NOT a stack trace or undefined body.
        const errStr =
            (typeof res.body.error === 'string' && res.body.error) ||
            (typeof res.body.message === 'string' && res.body.message) ||
            '';
        expect(errStr.length).toBeGreaterThan(0);
        // Stack frames must not leak.
        expect(errStr).not.toMatch(/at\s+\S+\s+\(/);
    });

    it('does not cache an error response (next request re-attempts the DB call)', async () => {
        findSpy.mockImplementationOnce(() => ({
            sort: () => ({
                lean: async () => { throw new Error('transient'); },
            }),
        }));

        const r1 = await request(app).get('/api/curriculum');
        expect(r1.status).toBe(500);

        // Recovery: model now succeeds — route should retry, not serve cached error.
        const r2 = await request(app).get('/api/curriculum');
        expect(r2.status).toBe(200);
        expect(r2.body).toHaveLength(2);
    });
});

describe('Issue #129 — GET /api/curriculum/:level remains unaffected', () => {
    it('returns the level doc on success', async () => {
        const res = await request(app).get('/api/curriculum/1');
        expect(res.status).toBe(200);
        expect(res.body.level).toBe('1');
        expect(res.body.units).toHaveLength(2);
    });

    it('returns 404 for an unknown level', async () => {
        const res = await request(app).get('/api/curriculum/99');
        expect(res.status).toBe(404);
    });
});
