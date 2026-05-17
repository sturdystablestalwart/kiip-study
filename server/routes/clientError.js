/**
 * POST /api/_log/client-error
 *
 * Issue #185 — receives best-effort client-side ErrorBoundary crashes
 * and forwards them into pino so production failures surface in
 * structured logs instead of vanishing into the browser console.  No
 * persistence — these are debug breadcrumbs, not user content.
 *
 * Rate-limited (20/min/IP) so a bogus client-side render loop can't
 * flood the log pipeline.  All fields are capped server-side before
 * logging in case the client lies about the cap.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const router = express.Router();

const CAP = 4000;
const UA_CAP = 200;

const clientErrorLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/_log/client-error', clientErrorLimiter, express.json({ limit: '12kb' }), (req, res) => {
    const body = req.body || {};
    logger.warn({
        clientError: true,
        message: String(body.message || '').slice(0, CAP),
        stack: String(body.stack || '').slice(0, CAP),
        componentStack: String(body.componentStack || '').slice(0, CAP),
        clientUrl: String(body.url || '').slice(0, 500),
        ua: String(body.ua || '').slice(0, UA_CAP),
        userId: req.user?._id,
        ip: req.ip,
    }, 'client ErrorBoundary report');
    res.status(204).end();
});

module.exports = router;
