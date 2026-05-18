/**
 * Fail-fast / warn-fast env-var validation (issue #32).
 *
 * `requireEnv` throws at boot if any key is missing — used for vars the
 * server cannot meaningfully run without (MONGO_URI, JWT_SECRET, etc.).
 * `warnEnv` emits a single pino warning per missing key but does NOT
 * throw — used for vars that gate optional features (Gemini, SMTP,
 * Google OAuth).  Routes that depend on those keys should also surface
 * a 503 with a clear message at call time, not a generic 500.
 */
const logger = require('./logger');

function requireEnv(keys) {
    const missing = (keys || []).filter((k) => !process.env[k]);
    if (missing.length) {
        throw new Error(
            `Missing required env vars: ${missing.join(', ')} — refusing to start. ` +
            'Check server/.env or your deployment secrets.'
        );
    }
}

function warnEnv(keys, featureLabel) {
    const missing = (keys || []).filter((k) => !process.env[k]);
    if (missing.length) {
        logger.warn(
            { missing, feature: featureLabel || 'optional' },
            'Optional env vars not set — feature degraded'
        );
    }
}

// Issue #439 — return ADMIN_EMAIL trimmed + lowercased so the
// comparison against passport's (always-lowercase) user email is not
// silently denied by a mixed-case env value. Returns '' when unset so
// callers can short-circuit without crashing.
function getAdminEmail() {
    return (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

module.exports = { requireEnv, warnEnv, getAdminEmail };
