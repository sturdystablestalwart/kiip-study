const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');
const { checkAgainstExisting } = require('../utils/dedup');

const crypto = require('crypto');
const upload = multer({
  dest: path.join(__dirname, '../uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only XLSX and CSV files are allowed'), false);
  },
});

// GET /import-template
router.get('/import-template', requireAuth, requireAdmin, async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Questions');
  sheet.columns = [
    { header: 'Test Title', key: 'testTitle', width: 30 },
    { header: 'Question Text', key: 'questionText', width: 50 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Option A', key: 'optionA', width: 25 },
    { header: 'Option B', key: 'optionB', width: 25 },
    { header: 'Option C', key: 'optionC', width: 25 },
    { header: 'Option D', key: 'optionD', width: 25 },
    { header: 'Correct Answer', key: 'correctAnswer', width: 20 },
    { header: 'Explanation', key: 'explanation', width: 40 },
    { header: 'Level', key: 'level', width: 10 },
    { header: 'Unit', key: 'unit', width: 10 },
  ];
  sheet.addRow({
    testTitle: 'KIIP Level 2 Unit 5', questionText: '한국에서 가장 큰 도시는 어디입니까?',
    type: 'mcq-single', optionA: '서울', optionB: '부산', optionC: '인천', optionD: '대구',
    correctAnswer: 'A', explanation: 'Seoul is the largest city.', level: 'Level 2', unit: 'Unit 5',
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=kiip-import-template.xlsx');
  await workbook.xlsx.write(res);
});

// POST /bulk-import
router.post('/bulk-import', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let rows = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const sheet = workbook.worksheets[0];
      const headers = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value).trim();
      });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        row.eachCell((cell, colNumber) => {
          obj[headers[colNumber - 1]] = cell.value;
        });
        rows.push(obj);
      });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      rows = parsed.data;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Use XLSX or CSV.' });
    }

    const preview = validateAndGroup(rows);

    // Check duplicates against existing tests
    const existingTests = await Test.find({}).lean();
    const existingQuestions = [];
    for (const t of existingTests) {
      for (const q of t.questions) {
        existingQuestions.push({ ...q, testTitle: t.title });
      }
    }

    for (const testData of preview.tests) {
      const dupResults = checkAgainstExisting(testData.questions, existingQuestions);
      testData.duplicateWarnings = dupResults;
    }

    // Store preview
    const previewId = crypto.randomUUID().replace(/-/g, '');
    const tempDir = path.join(__dirname, '../uploads/temp/');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const previewPath = path.join(tempDir, `preview-${previewId}.json`);
    fs.writeFileSync(previewPath, JSON.stringify(preview));

    res.json({ previewId, ...preview });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to parse file' });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// POST /bulk-import/confirm
router.post('/bulk-import/confirm', requireAuth, requireAdmin, async (req, res) => {
  const previewId = String(req.body.previewId || '').replace(/[^a-z0-9]/gi, '');
  if (!previewId) return res.status(400).json({ error: 'Invalid preview ID' });
  const previewPath = path.join(__dirname, `../uploads/temp/preview-${previewId}.json`);

  if (!fs.existsSync(previewPath)) {
    return res.status(404).json({ error: 'Preview expired. Please re-upload.' });
  }

  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf-8'));
  fs.unlinkSync(previewPath);

  const results = { imported: 0, skipped: 0, errors: [] };
  for (const testData of preview.tests) {
    if (testData.errors && testData.errors.length > 0) { results.skipped++; continue; }
    try {
      const test = new Test({
        title: testData.title, level: testData.level, unit: testData.unit,
        category: 'Imported', questions: testData.questions,
      });
      await test.save();
      results.imported++;
    } catch (err) {
      results.errors.push({ title: testData.title, error: err.message });
    }
  }

  res.json(results);
});

function validateAndGroup(rows) {
  const testsMap = new Map();
  const globalErrors = [];
  const validTypes = ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const title = String(row['Test Title'] || '').trim();
    const text = String(row['Question Text'] || '').trim();
    const type = String(row['Type'] || 'mcq-single').trim().toLowerCase();
    const correctAnswer = String(row['Correct Answer'] || '').trim();

    if (!title) { globalErrors.push({ row: rowNum, error: 'Missing test title' }); return; }
    if (!text) { globalErrors.push({ row: rowNum, error: 'Missing question text' }); return; }
    if (!validTypes.includes(type)) { globalErrors.push({ row: rowNum, error: `Invalid type: ${type}` }); return; }

    const question = { text, type };
    if (type === 'mcq-single' || type === 'mcq-multiple') {
      const options = ['A', 'B', 'C', 'D']
        .map(letter => row[`Option ${letter}`])
        .filter(Boolean)
        .map(opt => String(opt).trim());
      if (options.length < 2) { globalErrors.push({ row: rowNum, error: 'MCQ needs at least 2 options' }); return; }
      const correctLetters = correctAnswer.toUpperCase().split(/[,\s]+/);
      question.options = options.map((text, i) => ({
        text, isCorrect: correctLetters.includes(String.fromCharCode(65 + i)),
      }));
    } else if (type === 'short-answer') {
      question.acceptedAnswers = correctAnswer.split(/[,|]/).map(a => a.trim());
    } else if (type === 'ordering') {
      question.correctOrder = correctAnswer.split(/[,\s]+/).map(Number);
    } else if (type === 'fill-in-the-blank') {
      question.blanks = correctAnswer.split('|').map(answers => ({
        acceptedAnswers: answers.split(',').map(a => a.trim()),
      }));
    }
    if (row['Explanation']) question.explanation = String(row['Explanation']).trim();

    if (!testsMap.has(title)) {
      testsMap.set(title, {
        title, level: row['Level'] ? String(row['Level']).trim() : undefined,
        unit: row['Unit'] ? String(row['Unit']).trim() : undefined,
        questions: [], errors: [],
      });
    }
    testsMap.get(title).questions.push(question);
  });

  return { tests: Array.from(testsMap.values()), totalRows: rows.length, globalErrors };
}

module.exports = router;
