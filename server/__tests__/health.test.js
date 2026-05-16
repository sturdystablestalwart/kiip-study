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

    beforeEach(() => {
        // Stub mongoose.connection.readyState — it's a getter on the
        // Connection prototype, so we redefine the property on the live
        // connection object for the duration of each test.
        readyStateSpy = null;
    });

    afterEach(() => {
        if (readyStateSpy) readyStateSpy.mockRestore();
        vi.restoreAllMocks();
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
});
