const fs = require('fs');
const path = require('path');
const Test = require('../models/Test');
const { classifyTest } = require('./classifier');
const logger = require('./logger');

const autoImportTests = async (parseFunction) => {
    const testsDir = path.join(__dirname, '../../additionalContext/tests');
    if (!fs.existsSync(testsDir)) {
        console.log('Tests directory not found, skipping auto-import.');
        return;
    }

    const files = fs.readdirSync(testsDir).filter(
        file => file.endsWith('.md') || file.endsWith('.txt')
    );

    for (const file of files) {
        const filePath = path.join(testsDir, file);
        const fileName = path.parse(file).name;

        console.log(`Auto-import: checking ${fileName}...`);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsedData = await parseFunction(content);
            const title = parsedData.title || fileName;

            const existing = await Test.findOne({ title });
            if (existing) {
                console.log(`  Skipping "${title}" — already exists`);
                continue;
            }

            const classification = await classifyTest(parsedData.questions, title);

            const newTest = new Test({
                title,
                source: 'auto-imported',
                ...classification,
                questions: parsedData.questions
            });
            await newTest.save();
            console.log(`  Imported "${title}" → level=${classification.level}, unit=${classification.unitNumber}, type=${classification.contentType}`);
        } catch (err) {
            logger.error({ err }, `Failed to import ${fileName}`);
        }
    }
};

module.exports = autoImportTests;
