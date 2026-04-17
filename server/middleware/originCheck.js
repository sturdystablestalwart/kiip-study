const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function createOriginCheck(allowedOrigins) {
    const allowed = new Set(allowedOrigins.map(o => o.toLowerCase()));

    return (req, res, next) => {
        if (!UNSAFE_METHODS.has(req.method)) return next();

        const origin = (req.headers.origin || '').toLowerCase();
        if (origin && allowed.has(origin)) return next();

        const referer = req.headers.referer || '';
        if (referer) {
            try {
                const refOrigin = new URL(referer).origin.toLowerCase();
                if (allowed.has(refOrigin)) return next();
            } catch { /* bad URL */ }
        }

        return res.status(403).json({ message: 'Origin not allowed' });
    };
}

module.exports = { createOriginCheck };
