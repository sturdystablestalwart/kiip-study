const MONGO_OPS = new Set(['$gt','$gte','$lt','$lte','$ne','$in','$nin','$regex','$exists','$or','$and','$not','$nor','$where','$elemMatch','$size','$type','$mod','$text','$all']);
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) { obj.forEach(sanitize); return obj; }
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
            sanitize(obj[key]);
        }
    }
    return obj;
}

function sanitizeMiddleware(req, _res, next) {
    if (req.body) sanitize(req.body);
    if (req.params) sanitize(req.params);
    // Express 5: req.query is a getter, so sanitize the parsed values in-place
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            if (key.startsWith('$') || key.includes('.')) {
                delete req.query[key];
            } else if (typeof req.query[key] === 'object' && req.query[key] !== null) {
                if (!Array.isArray(req.query[key])) {
                    const valueKeys = Object.keys(req.query[key]);
                    if (valueKeys.some(k => MONGO_OPS.has(k))) {
                        delete req.query[key];
                        continue;
                    }
                }
                sanitize(req.query[key]);
            }
        }
    }
    next();
}

module.exports = { sanitize, sanitizeMiddleware };
