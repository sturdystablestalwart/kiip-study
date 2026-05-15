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

            const existing = await Test.findOne({ title });
            if (existing) {
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

            const newTest = new Test({
                title,
                source: 'auto-imported',
                ...classification,
                questions: parsedData.questions
            });
            await newTest.save();
            logger.info({ title, classification }, 'Imported test');
        } catch (err) {
            logger.error({ err }, `Failed to import ${fileName}`);
        }
    }
};

module.exports = autoImportTests;
