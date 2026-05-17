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
const { validateQuestion } = require('../utils/contentValidator');
const safeError = require('../utils/safeError');
const logger = require('../utils/logger');

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

  // Issue #133 — streaming `workbook.xlsx.write(res)` without try/catch
  // surfaced as 500 + 'headers already sent' warnings when the client
  // disconnected mid-stream (EPIPE).  Track close, swallow EPIPE /
  // ERR_STREAM_DESTROYED after headers have gone out, surface a clean
  // 500 only when the response is still writable.
  let aborted = false;
  res.on('close', () => { if (!res.writableEnded) aborted = true; });

  try {
    await workbook.xlsx.write(res);
  } catch (err) {
    if (aborted || err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
      logger.warn({ err: { code: err.code, message: err.message } }, 'import-template stream aborted');
      return;
    }
    if (!res.headersSent) {
      logger.error({ err }, 'import-template generation failed before headers');
      return res.status(500).json({ error: 'Failed to generate template' });
    }
    logger.error({ err }, 'import-template generation failed mid-stream');
    try { res.destroy(err); } catch { /* ignore */ }
  }
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

    // Issue #37 — defence-in-depth sanitisation: abort entire import on first
    // failure rather than partial-insert.  Matches the "DO NOT do partial
    // insert" rule from the security remediation plan.
    if (preview.validationFailure) {
      return res.status(400).json({
        error: 'Validation failed',
        index: preview.validationFailure.index,
        reason: preview.validationFailure.reason,
      });
    }

    // Check duplicates against existing tests
    const existingTests = await Test.find({}, { title: 1, 'questions.text': 1 }).lean();
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
    logger.error({ err }, 'Bulk import error');
    res.status(500).json({ error: safeError('Bulk import failed', err) });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

// POST /bulk-import/confirm
router.post('/bulk-import/confirm', requireAuth, requireAdmin, async (req, res) => {
  const previewId = String(req.body.previewId || '').replace(/[^a-z0-9]/gi, '');
  if (!previewId) return res.status(400).json({ error: 'Invalid preview ID' });
  const tempBase = path.resolve(__dirname, '../uploads/temp');
  const previewPath = path.resolve(tempBase, `preview-${previewId}.json`);
  if (!previewPath.startsWith(tempBase)) return res.status(400).json({ error: 'Invalid path' });

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
        title: testData.title, level: testData.level, unitNumber: testData.unitNumber,
        source: 'bulk-import', questions: testData.questions,
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
  // Global, zero-based index of every question that survives shape checks.
  // Used by validateQuestion() for stable error addressing across the import.
  let questionIdx = 0;
  let validationFailure = null;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;
    const title = String(row['Test Title'] || '').trim();
    const text = String(row['Question Text'] || '').trim();
    const type = String(row['Type'] || 'mcq-single').trim().toLowerCase();
    const correctAnswer = String(row['Correct Answer'] || '').trim();

    if (!title) { globalErrors.push({ row: rowNum, error: 'Missing test title' }); continue; }
    if (!text) { globalErrors.push({ row: rowNum, error: 'Missing question text' }); continue; }
    if (!validTypes.includes(type)) { globalErrors.push({ row: rowNum, error: `Invalid type: ${type}` }); continue; }

    const question = { text, type };
    if (type === 'mcq-single' || type === 'mcq-multiple') {
      const options = ['A', 'B', 'C', 'D']
        .map(letter => row[`Option ${letter}`])
        .filter(Boolean)
        .map(opt => String(opt).trim());
      if (options.length < 2) { globalErrors.push({ row: rowNum, error: 'MCQ needs at least 2 options' }); continue; }
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

    // Issue #37 — content sanitisation & length caps.  Mirrors the rules
    // applied to Gemini-LLM output in utils/llmValidator.js so the import
    // path can't bypass them.  First failure aborts the whole batch.
    const check = validateQuestion(question, questionIdx);
    if (!check.ok) {
      validationFailure = {
        index: check.idx,
        reason: check.reason,
        row: rowNum,
      };
      logger.warn(
        { row: rowNum, index: check.idx, reason: check.reason },
        'Bulk import rejected: content validation failed'
      );
      break;
    }
    questionIdx++;

    if (!testsMap.has(title)) {
      testsMap.set(title, {
        title, level: row['Level'] ? String(row['Level']).trim() : undefined,
        unitNumber: row['Unit'] ? parseInt(row['Unit']) : undefined,
        questions: [], errors: [],
      });
    }
    testsMap.get(title).questions.push(question);
  }

  return {
    tests: Array.from(testsMap.values()),
    totalRows: rows.length,
    globalErrors,
    validationFailure,
  };
}

// --- Temp file cleanup (TTL: 1 hour) ---
const TEMP_DIR = path.join(__dirname, '../uploads/temp');
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function cleanupTempPreviews() {
    try {
        const entries = await fs.promises.readdir(TEMP_DIR).catch(() => []);
        const now = Date.now();
        for (const name of entries) {
            if (!name.startsWith('preview-')) continue;
            const full = path.join(TEMP_DIR, name);
            try {
                const stat = await fs.promises.stat(full);
                if (now - stat.mtimeMs > MAX_AGE_MS) await fs.promises.unlink(full);
            } catch { /* ignore individual file errors */ }
        }
    } catch { /* ignore — temp dir may not exist yet */ }
}

cleanupTempPreviews();
setInterval(cleanupTempPreviews, 15 * 60 * 1000).unref();

module.exports = router;
