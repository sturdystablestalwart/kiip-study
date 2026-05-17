const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const loadSecret = require('../utils/loadSecret');

// Issue #9 — JWT_SECRET resolves from /run/secrets/jwt_secret first
// (Docker Secrets), env var second.  The error message is unchanged so
// the existing boot-time guard test still matches.
const JWT_SECRET = loadSecret('JWT_SECRET');
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.jwt;
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: 'kiip-study',
            audience: 'kiip-study-api',
            algorithms: ['HS256'],
            clockTolerance: 10,
        });
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        // Issue #33 — propagate userId into the request-scoped log
        // context so every subsequent log line on this request shares
        // both reqId and userId.
        logger.setContextField('userId', String(user._id));
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
