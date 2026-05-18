// Issue #498 — defense-in-depth CSRF layer on top of SameSite=Lax +
// originCheck (#71 / #129). csrf-csrf implements the double-submit
// cookie pattern: a non-HttpOnly token cookie + an X-CSRF-Token
// header / body field that must HMAC-match.
//
// This module exports the configured pieces ready for wiring; the
// route-enforcement switch lives in server/index.js so test scaffolds
// can opt out (NODE_ENV=test, dedicated test-only routes, etc.). See
// the consumer site for the rollout plan.
//
// Required env: CSRF_SECRET (distinct from JWT_SECRET; fallback to
// JWT_SECRET so single-secret deployments work, with a warn so the
// operator can see the dependency).

const { doubleCsrf } = require('csrf-csrf');
const loadSecret = require('../utils/loadSecret');
const logger = require('../utils/logger');

function getCsrfSecret() {
    const explicit = loadSecret('CSRF_SECRET');
    if (explicit) return explicit;
    const fallback = loadSecret('JWT_SECRET');
    if (!fallback) throw new Error('CSRF_SECRET missing and JWT_SECRET fallback also missing');
    if (process.env.NODE_ENV !== 'test') {
        logger.warn('CSRF_SECRET not configured — falling back to JWT_SECRET. Set a distinct CSRF_SECRET for defense-in-depth.');
    }
    return fallback;
}

const csrf = doubleCsrf({
    getSecret: getCsrfSecret,
    // __Host- prefix requires Secure + Path=/ + no Domain in prod.
    cookieName: process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf-token',
    cookieOptions: {
        httpOnly: false,                    // client JS must read it to mirror into header
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    },
    size: 64,                               // bytes of entropy
    getCsrfTokenFromRequest: (req) =>
        req.headers['x-csrf-token'] || req.body?._csrf,
});

module.exports = csrf;
