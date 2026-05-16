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
// Contract:
//   mongoose.connection.readyState === 1  → 200, { ok: true,  mongo: 'connected', uptime }
//   readyState ∈ {0, 2, 3, …}              → 503, { ok: false, mongo: <stateName>,  uptime }
//
// readyState values (per mongoose docs):
//   0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting.

const STATE_NAMES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

function healthHandler(req, res) {
    const mongoState = mongoose.connection.readyState;
    const ok = mongoState === 1;
    const mongo = STATE_NAMES[mongoState] || 'unknown';

    if (!ok) {
        // Surface degraded state in structured logs so operators can correlate
        // a 503 spike with a recent mongo disconnect/restart.
        logger.warn({ mongoState, mongo }, 'health check degraded');
    }

    res.status(ok ? 200 : 503).json({
        ok,
        // `status` retained for backward-compat with existing callers
        // (Playwright E2E tests/app.spec.js, ops dashboards, README docs).
        status: ok ? 'ok' : 'degraded',
        mongo,
        uptime: process.uptime(),
    });
}

module.exports = healthHandler;
