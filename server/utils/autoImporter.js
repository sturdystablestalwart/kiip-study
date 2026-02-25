const fs = require('fs');
const path = require('path');
const Test = require('../models/Test');

const autoImportTests = async (parseFunction) => {
    const testsDir = path.join(__dirname, '../../additionalContext/tests');
    if (!fs.existsSync(testsDir)) {
        console.log('Tests directory not found, skipping auto-import.');
        return;
    }

    const files = fs.readdirSync(testsDir).filter(file => file.endsWith('.md') || file.endsWith('.txt'));

    for (const file of files) {
        const filePath = path.join(testsDir, file);
        const fileName = path.parse(file).name;

        // Check if test already exists in DB
        const existing = await Test.findOne({ title: { $regex: new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } });
        if (existing) continue;

        console.log(`Auto-importing test: ${fileName}`);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const parsedData = await parseFunction(content);
            
            // Extract level from title or filename (e.g. "Level 2", "2단계")
            const title = parsedData.title || fileName;
            const levelMatch = title.match(/Level\s*(\d)/i) || title.match(/(\d)\s*단계/);
            const level = levelMatch ? `Level ${levelMatch[1]}` : undefined;

            const newTest = new Test({
                title,
                category: 'Auto-Imported',
                level,
                questions: parsedData.questions
            });
            await newTest.save();
            console.log(`Successfully imported ${fileName}`);
        } catch (err) {
            console.error(`Failed to import ${fileName}:`, err.message);
        }
    }
};

module.exports = autoImportTests;
