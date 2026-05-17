const fs = require('fs');
const path = require('path');
const Test = require('../models/Test');
const { classifyTest } = require('./classifier');
const logger = require('./logger');

const autoImportTests = async (parseFunction) => {
    const testsDir = path.join(__dirname, '../../additionalContext/tests');
    if (!fs.existsSync(testsDir)) {
        logger.info('Tests directory not found, skipping auto-import.');
        return;
    }

    const files = fs.readdirSync(testsDir).filter(
        file => file.endsWith('.md') || file.endsWith('.txt')
    );

    for (const file of files) {
        const filePath = path.join(testsDir, file);
        const fileName = path.parse(file).name;

        logger.info({ fileName }, 'Auto-import: checking');
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsedData = await parseFunction(content);
            const title = parsedData.title || fileName;

            // Issue #136 — fast existence check (uses the new
            // single-field { title: 1 } index instead of scanning) so we
            // skip the expensive Gemini classifier call when the doc
            // already exists.  The actual insert is then an atomic
            // findOneAndUpdate upsert so two concurrent boots can't
            // double-insert on the same title.
            const exists = await Test.exists({ title });
            if (exists) {
                logger.info({ title }, 'Skipping — already exists');
                continue;
            }

            // Classification is non-fatal: if Gemini fails (e.g. CI placeholder
            // key, network error, schema mismatch) we still save the test with
            // the Test schema's own defaults (contentType: 'general', level
            // unset) rather than dropping it on the floor and leaving CI / dev
            // with an empty DB. Refs #222.
            let classification;
            try {
                classification = await classifyTest(parsedData.questions, title);
            } catch (classifyErr) {
                logger.warn(
                    { err: classifyErr, title },
                    'Classifier failed; saving test with default classification'
                );
                classification = {};
            }

            const result = await Test.findOneAndUpdate(
                { title },
                {
                    $setOnInsert: {
                        title,
                        source: 'auto-imported',
                        ...classification,
                        questions: parsedData.questions,
                    },
                },
                { upsert: true, new: true, includeResultMetadata: true },
            );
            const insertedFresh = result?.lastErrorObject?.updatedExisting === false;
            if (insertedFresh) {
                logger.info({ title, classification }, 'Imported test');
            } else {
                logger.info({ title }, 'Race avoided — concurrent insert won');
            }
        } catch (err) {
            logger.error({ err }, `Failed to import ${fileName}`);
        }
    }
};

module.exports = autoImportTests;
