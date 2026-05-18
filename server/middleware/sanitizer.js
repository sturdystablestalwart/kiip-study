// Issue #130 — single recursive sanitize() applies the same rules at
// every depth (root, body, params, query, arbitrarily nested objects).
// Previously the middleware re-implemented the root-level rules inline
// for req.query, creating two sets of rules a future contributor had to
// reason about.  Now there's exactly one rule set, expressed once.
const MONGO_OPS = new Set(['$gt','$gte','$lt','$lte','$ne','$in','$nin','$regex','$exists','$or','$and','$not','$nor','$where','$elemMatch','$size','$type','$mod','$text','$all']);
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Issue #444 — bound recursion depth so adversary-supplied deeply-
// nested JSON (~125k levels fits in our 1MB body cap; Node's default
// call stack is ~10k frames) can't trigger a RangeError DoS. Beyond
// MAX_DEPTH the sub-tree is treated as opaque (no recursion); the
// suspicious payload is still rejected later by the route's
// express-validator gates.
const MAX_DEPTH = 32;

function sanitize(obj, depth = 0) {
    if (depth > MAX_DEPTH) return obj;
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) { obj.forEach((v) => sanitize(v, depth + 1)); return obj; }
    for (const key of Object.keys(obj)) {
        if (PROTO_KEYS.has(key) || key.startsWith('$') || key.includes('.')) {
            delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (!Array.isArray(obj[key])) {
                const valueKeys = Object.keys(obj[key]);
                if (valueKeys.some(k => MONGO_OPS.has(k))) {
                    delete obj[key];
                    continue;
                }
            }
            sanitize(obj[key], depth + 1);
        }
    }
    return obj;
}

function sanitizeMiddleware(req, _res, next) {
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);
    // Express 5: req.query is a getter that caches its parsed result on
    // first access.  Mutating that cached object in-place persists for
    // the rest of the request lifecycle, so we can delegate to the same
    // sanitize() instead of re-implementing the rules here.
    if (req.query && typeof req.query === 'object') sanitize(req.query);
    next();
}

module.exports = { sanitize, sanitizeMiddleware };
