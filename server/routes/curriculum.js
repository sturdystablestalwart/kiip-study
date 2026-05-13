const express = require('express');
const router = express.Router();
const Curriculum = require('../models/Curriculum');

// GET /api/curriculum — all levels with units (public, no auth)
router.get('/', async (req, res) => {
    const data = await Curriculum.find({}).sort({ level: 1 }).lean();
    res.json(data);
});

// GET /api/curriculum/:level — units for a specific level
router.get('/:level', async (req, res) => {
    const doc = await Curriculum.findOne({ level: req.params.level }).lean();
    if (!doc) return res.status(404).json({ error: 'Level not found' });
    res.json(doc);
});

module.exports = router;
