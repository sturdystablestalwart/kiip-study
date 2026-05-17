import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

// ─── /health degraded-mongo status code ───────────────────────────────────
//
// Regression for issue #96: /health (and /api/health) previously returned
// HTTP 200 regardless of MongoDB state — only the body's `status` field
// flipped to 'degraded'. External monitors (StatusCake, Docker compose
// healthcheck via wget) key off the HTTP status code, so a half-healthy
// app with mongo disconnected was reported as healthy.
//
// Contract under test:
//   - readyState === 1 (connected)     → 200, { ok: true,  mongo: 'connected' }
//   - readyState !== 1 (anything else) → 503, { ok: false, mongo: <stateName> }
//
// We exercise the real handler exported from server/utils/healthHandler.js
// by mounting it on a throw-away Express app — keeps tests fast and isolates
// from the full server boot (mongoose.connect, app.listen, autoImporter, …).

const require = createRequire(import.meta.url);
const healthHandler = require('../utils/healthHandler');

function buildApp() {
    const app = express();
    app.get('/health', healthHandler);
    app.get('/api/health', healthHandler);
    return app;
}

describe('GET /health — mongoose readyState gating', () => {
    let readyStateSpy;
    const savedEnv = {};
    const REQUIRED = ['JWT_SECRET', 'GEMINI_API_KEY'];

    beforeEach(() => {
        readyStateSpy = null;
        // Issue #92 — handler now also gates on required env vars.
        // Provide placeholders so the connected-mongo path returns 200.
        for (const k of REQUIRED) {
            savedEnv[k] = process.env[k];
            process.env[k] = process.env[k] || 'health-test-placeholder';
        }
    });

    afterEach(() => {
        if (readyStateSpy) readyStateSpy.mockRestore();
        vi.restoreAllMocks();
        for (const k of REQUIRED) {
            if (savedEnv[k] === undefined) delete process.env[k];
            else process.env[k] = savedEnv[k];
        }
    });

    function stubReadyState(value) {
        readyStateSpy = vi
            .spyOn(mongoose.connection, 'readyState', 'get')
            .mockReturnValue(value);
    }

    it('returns 200 with ok:true when mongo is connected (readyState=1)', async () => {
        stubReadyState(1);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.mongo).toBe('connected');
        // back-compat field consumed by Playwright E2E (tests/app.spec.js)
        expect(res.body.status).toBe('ok');
    });

    it('returns 503 with ok:false when mongo is disconnected (readyState=0)', async () => {
        stubReadyState(0);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);
        expect(res.body.mongo).toBe('disconnected');
        expect(res.body.status).toBe('degraded');
    });

    it('returns 503 when mongo is connecting (readyState=2)', async () => {
        stubReadyState(2);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);
        expect(res.body.mongo).toBe('connecting');
    });

    it('returns 503 when mongo is disconnecting (readyState=3)', async () => {
        stubReadyState(3);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);
        expect(res.body.mongo).toBe('disconnecting');
    });

    it('also gates /api/health on readyState', async () => {
        stubReadyState(0);
        const res = await request(buildApp()).get('/api/health');
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);
    });

    // ─── Issue #92 — env / version / build coverage ─────────────────
    it('returns 503 with env.missing when JWT_SECRET is absent', async () => {
        stubReadyState(1);
        delete process.env.JWT_SECRET;
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);
        expect(res.body.env.ok).toBe(false);
        expect(res.body.env.missing).toContain('JWT_SECRET');
    });

    it('returns 503 with env.missing when GEMINI_API_KEY is absent', async () => {
        stubReadyState(1);
        delete process.env.GEMINI_API_KEY;
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body.env.missing).toContain('GEMINI_API_KEY');
    });

    it('reports version and buildSha (defaulting to "dev")', async () => {
        stubReadyState(1);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(200);
        expect(typeof res.body.version).toBe('string');
        expect(typeof res.body.buildSha).toBe('string');
    });

    it('reports APP_VERSION / BUILD_SHA when set at boot', async () => {
        stubReadyState(1);
        const savedV = process.env.APP_VERSION;
        const savedS = process.env.BUILD_SHA;
        process.env.APP_VERSION = '1.2.3';
        process.env.BUILD_SHA = 'deadbeef';
        try {
            const res = await request(buildApp()).get('/health');
            expect(res.body.version).toBe('1.2.3');
            expect(res.body.buildSha).toBe('deadbeef');
        } finally {
            if (savedV === undefined) delete process.env.APP_VERSION; else process.env.APP_VERSION = savedV;
            if (savedS === undefined) delete process.env.BUILD_SHA;   else process.env.BUILD_SHA = savedS;
        }
    });
});
