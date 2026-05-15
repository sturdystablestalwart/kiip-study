const express = require('express');
const router = express.Router();
const Curriculum = require('../models/Curriculum');
const safeError = require('../utils/safeError');
const logger = require('../utils/logger');

// ── In-memory cache for the full curriculum list ──
// Curriculum docs only change via redeploy (seeded at boot in server/index.js),
// so a long TTL is safe. Pattern mirrors classifier.getTaxonomy.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches Cache-Control: max-age=3600
let cachedAll = null;
let cachedAt = 0;

function resetCache() {
    cachedAll = null;
    cachedAt = 0;
}

// GET /api/curriculum — all levels with units (public, no auth)
router.get('/', async (req, res) => {
    try {
        if (!cachedAll || (Date.now() - cachedAt) >= CACHE_TTL_MS) {
            cachedAll = await Curriculum.find({}).sort({ level: 1 }).lean();
            cachedAt = Date.now();
        }
        res.set('Cache-Control', 'public, max-age=3600');
        res.json(cachedAll);
    } catch (err) {
        logger.error({ err }, 'GET /api/curriculum failed');
        res.status(500).json({ message: safeError('Failed to fetch curriculum', err) });
    }
});

// GET /api/curriculum/:level — units for a specific level
router.get('/:level', async (req, res) => {
    try {
        const doc = await Curriculum.findOne({ level: req.params.level }).lean();
        if (!doc) return res.status(404).json({ error: 'Level not found' });
        res.set('Cache-Control', 'public, max-age=3600');
        res.json(doc);
    } catch (err) {
        logger.error({ err, level: req.params.level }, 'GET /api/curriculum/:level failed');
        res.status(500).json({ message: safeError('Failed to fetch curriculum level', err) });
    }
});

module.exports = router;
// Exposed for tests + future admin mutation routes that need to bust the cache.
module.exports.__resetCache = resetCache;
