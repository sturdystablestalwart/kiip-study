// Issue #454 — /health (and /api/health) public response must be
// LEAN: only { ok: boolean }. Verbose diagnostic payload (env.missing,
// buildSha, uptime, mongo state) is moved to /api/health/internal
// behind requireAuth + requireAdmin.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const requireCJS = createRequire(import.meta.url);
const { healthHandlerPublic } = requireCJS('../utils/healthHandler');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexSrc = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf8');

function buildApp() {
    const app = express();
    app.get('/health', healthHandlerPublic);
    return app;
}

describe('Issue #454 — public /health body is lean', () => {
    let readyStateSpy;
    const savedEnv = {};
    const REQUIRED = ['JWT_SECRET', 'GEMINI_API_KEY'];

    beforeEach(() => {
        readyStateSpy = null;
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

    function stub(value) {
        readyStateSpy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(value);
    }

    it('healthy: 200 with body limited to { ok: true }', async () => {
        stub(1);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });
    });

    it('degraded mongo: 503 with body limited to { ok: false }', async () => {
        stub(0);
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false });
    });

    it('missing env: 503 with body limited to { ok: false } (no env names leaked)', async () => {
        stub(1);
        delete process.env.JWT_SECRET;
        const res = await request(buildApp()).get('/health');
        expect(res.status).toBe(503);
        expect(res.body).toEqual({ ok: false });
        expect(JSON.stringify(res.body)).not.toMatch(/JWT_SECRET|GEMINI_API_KEY/);
    });
});

describe('Issue #454 — internal verbose handler mounted with admin gate', () => {
    it('index.js wires /api/health/internal behind requireAuth + requireAdmin', () => {
        expect(indexSrc).toMatch(/\/api\/health\/internal[\s\S]{0,200}requireAuth[\s\S]{0,40}requireAdmin/);
    });

    it('index.js mounts the LEAN handler on public /health', () => {
        expect(indexSrc).toMatch(/app\.get\(['"]\/health['"]\s*,\s*healthHandlerPublic\)/);
    });
});
