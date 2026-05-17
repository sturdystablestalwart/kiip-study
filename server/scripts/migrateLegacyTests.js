/**
 * One-time migration (issue #11): classify existing tests via LLM and
 * migrate old `category` / `unit` fields to the new `source` /
 * `unitNumber` shape.  Status: completed against production.
 *
 * Run: MIGRATE_CONFIRM=YES node server/scripts/migrateLegacyTests.js
 * See ops/MIGRATIONS.md for the full runbook.
 */
if (process.env.MIGRATE_CONFIRM !== 'YES') {
    console.error(
        'REFUSING TO RUN: this migration was completed on 2026-04-XX.\n' +
        'If you genuinely need to re-run, set MIGRATE_CONFIRM=YES.\n' +
        'See ops/MIGRATIONS.md for context.'
    );
    process.exit(2);
}

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Test = require('../models/Test');
const Curriculum = require('../models/Curriculum');
const curriculumSeed = require('../utils/curriculumSeed');
const { classifyTest } = require('../utils/classifier');

const SOURCE_MAP = {
    'Auto-Imported': 'auto-imported',
    'Text Input': 'ai-generated',
    'File Upload': 'file-upload',
    'Import': 'manual-import',
    'Imported': 'bulk-import',
    'General': 'ai-generated'
};

const LEVEL_MAP = {
    'Level 0': '0', 'Level 1': '1', 'Level 2': '2',
    'Level 3': '3', 'Level 4': '4', 'Level 5': '5-basic'
};

(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app');
    console.log('Connected to MongoDB');

    // Ensure curriculum is seeded
    if (await Curriculum.countDocuments() === 0) {
        await Curriculum.insertMany(curriculumSeed);
        console.log('Seeded curriculum');
    }

    const tests = await Test.find({});
    console.log(`Found ${tests.length} tests to migrate\n`);

    let migrated = 0;
    for (const test of tests) {
        const updates = {};
        const unsets = {};

        // Map old category → source (using raw document to access old field)
        const rawDoc = test.toObject();
        if (rawDoc.category && !test.source) {
            updates.source = SOURCE_MAP[rawDoc.category] || 'ai-generated';
        }

        // Map old level format ("Level 2" → "2")
        if (test.level && LEVEL_MAP[test.level]) {
            updates.level = LEVEL_MAP[test.level];
        }

        // Remove old fields
        unsets.category = 1;
        unsets.unit = 1;

        // Classify via LLM if missing contentType
        if (!test.contentType || test.contentType === 'general') {
            try {
                console.log(`  Classifying "${test.title}"...`);
                const c = await classifyTest(test.questions, test.title);
                if (c.level) updates.level = c.level;
                if (c.unitNumber != null) updates.unitNumber = c.unitNumber;
                if (c.section) updates.section = c.section;
                if (c.contentType && c.contentType !== 'general') updates.contentType = c.contentType;
            } catch (err) {
                console.error(`  Failed to classify "${test.title}":`, err.message);
            }
        }

        const updateOp = { ...updates };
        if (Object.keys(unsets).length) updateOp.$unset = unsets;

        await Test.updateOne({ _id: test._id }, updateOp);
        migrated++;
        console.log(`  [${migrated}/${tests.length}] "${test.title}" → level=${updates.level || test.level}, unit=${updates.unitNumber}, type=${updates.contentType || test.contentType}\n`);
    }

    console.log(`\nMigration complete: ${migrated} tests processed`);
    await mongoose.disconnect();
})();
