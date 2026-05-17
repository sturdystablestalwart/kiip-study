const mongoose = require('mongoose');
const logger = require('./logger');

// /health (and /api/health) handler.
//
// Issue #96: previously this returned HTTP 200 unconditionally, with only
// the body's `status` field flipping to 'degraded' when mongo was down.
// External monitors (StatusCake, Docker compose `wget --spider`, uptime
// checks) key off the HTTP status code, so a half-healthy app was treated
// as healthy.
//
// Issue #92: extended to also surface env-var presence, app version and
// build SHA so external monitors detect a green mongo with an invalid
// GEMINI_API_KEY / missing JWT_SECRET (which would otherwise silently
// 5xx the LLM endpoints), and so incident responders can see which
// commit is running.
//
// Contract:
//   mongo connected AND required env vars present
//                                       → 200, { ok: true,  ... }
//   any of the above false              → 503, { ok: false, ... }
//
// readyState values (per mongoose docs):
//   0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.

const STATE_NAMES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

// The set of env vars the server cannot meaningfully run without.  Kept
// narrow — listing every optional var would dilute the signal.
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'GEMINI_API_KEY'];

function envCheck() {
    const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
    return { ok: missing.length === 0, missing };
}

function healthHandler(req, res) {
    const mongoState = mongoose.connection.readyState;
    const mongoOk = mongoState === 1;
    const mongo = STATE_NAMES[mongoState] || 'unknown';

    const env = envCheck();
    const ok = mongoOk && env.ok;

    if (!ok) {
        // Surface degraded state in structured logs so operators can correlate
        // a 503 spike with a recent mongo disconnect/restart or env regression.
        logger.warn({ mongoState, mongo, envMissing: env.missing }, 'health check degraded');
    }

    res.status(ok ? 200 : 503).json({
        ok,
        // `status` retained for backward-compat with existing callers
        // (Playwright E2E tests/app.spec.js, ops dashboards, README docs).
        status: ok ? 'ok' : 'degraded',
        mongo,
        env: { ok: env.ok, missing: env.missing },
        version: process.env.APP_VERSION || 'dev',
        buildSha: process.env.BUILD_SHA || 'dev',
        uptime: process.uptime(),
    });
}

module.exports = healthHandler;
