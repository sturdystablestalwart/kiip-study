const express = require('express');
const router = express.Router();
const multer = require('multer');
const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Test = require('../models/Test');
const AuditLog = require('../models/AuditLog');
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

    // Issue #64 — preview-stage dedup previously did `Test.find({}).lean()`
    // with no limit, so each preview pulled every test's question text into
    // memory.  Library growth made this unbounded.
    //
    // Fix:
    //   1. Hard cap of MAX_LIBRARY_SIZE tests for dedup.  Above the cap the
    //      preview short-circuits: the import still succeeds (admin gets
    //      `dedupSkipped: true` they can surface in the UI) but we don't
    //      OOM the server building a multi-million-question in-memory set.
    //   2. Stream the matching tests via a cursor + `for await`, so even
    //      under the cap we never hold all docs at once — only the running
    //      `existingQuestions` array (which is what dedup needs anyway).
    const MAX_LIBRARY_SIZE = 20000;
    const totalTests = await Test.estimatedDocumentCount();
    const existingQuestions = [];
    let dedupSkipped = false;
    if (totalTests > MAX_LIBRARY_SIZE) {
      // Skip dedup so the preview still returns; flag so UI can warn.
      dedupSkipped = true;
      logger.warn({ totalTests, cap: MAX_LIBRARY_SIZE }, 'Bulk import: skipping dedup — library above cap');
    } else {
      const cursor = Test.find({}, { title: 1, 'questions.text': 1 }).lean().cursor();
      for await (const t of cursor) {
        for (const q of (t.questions || [])) {
          existingQuestions.push({ ...q, testTitle: t.title });
        }
      }
    }

    for (const testData of preview.tests) {
      // When dedup is skipped (#64), pass an empty pool so the import
      // still proceeds; the UI shows `dedupSkipped` so the admin knows
      // duplicates weren't checked this time.
      const dupResults = dedupSkipped
        ? []
        : checkAgainstExisting(testData.questions, existingQuestions);
      testData.duplicateWarnings = dupResults;
    }
    if (dedupSkipped) preview.dedupSkipped = true;

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

  // Issue #61 — defence-in-depth: re-validate the preview structure
  // before persisting.  Even though /preview wrote this file ourselves
  // a few seconds ago, a truncated / locale-mangled / out-of-band-
  // tampered file would otherwise create malformed Test docs that
  // bypassed validateAndGroup()'s checks.
  // Issue #138 — switch to async fs.promises so the multi-MB JSON
  // read doesn't block the event loop while other requests starve.
  let preview;
  try {
    const raw = await fs.promises.readFile(previewPath, 'utf-8');
    preview = JSON.parse(raw);
  } catch (err) {
    logger.error({ err, previewId }, 'Bulk import preview unreadable');
    try { await fs.promises.unlink(previewPath); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Preview file unreadable. Please re-upload.' });
  }
  await fs.promises.unlink(previewPath).catch(() => {});

  if (!preview || typeof preview !== 'object' || !Array.isArray(preview.tests)) {
    return res.status(400).json({ error: 'Preview file malformed. Please re-upload.' });
  }
  const VALID_TYPES = new Set(['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank']);
  const VALID_LEVELS = new Set(['0', '1', '2', '3', '4', '5-basic', '5-advanced']);

  const results = { imported: 0, skipped: 0, errors: [] };
  // First pass: filter + shape-validate so we only insert valid docs.
  const toInsert = [];
  for (const testData of preview.tests) {
    if (testData.errors && testData.errors.length > 0) { results.skipped++; continue; }

    const shapeError =
        (!testData.title || typeof testData.title !== 'string' || testData.title.length > 500)
            ? 'invalid title' :
        (!Array.isArray(testData.questions) || testData.questions.length === 0)
            ? 'no questions' :
        (testData.questions.length > 200)
            ? 'too many questions (max 200)' :
        (testData.level && !VALID_LEVELS.has(String(testData.level)))
            ? `invalid level "${testData.level}"` :
        testData.questions.some((q) => !q || typeof q.text !== 'string' || !VALID_TYPES.has(q.type))
            ? 'invalid question shape' :
        null;
    if (shapeError) {
      results.errors.push({ title: testData.title || '(no title)', error: shapeError });
      continue;
    }

    toInsert.push({
      title: testData.title,
      level: testData.level,
      unitNumber: testData.unitNumber,
      source: 'bulk-import',
      questions: testData.questions,
    });
  }

  // Issue #138 — replace the serial `for (...) await test.save()` loop
  // with Test.insertMany({ ordered: false }) so the whole batch lands
  // in one round-trip.  ordered:false continues past per-doc errors and
  // we re-surface them in the response.
  if (toInsert.length > 0) {
    try {
      const inserted = await Test.insertMany(toInsert, { ordered: false });
      results.imported += inserted.length;
    } catch (err) {
      // BulkWriteError: some inserted, some failed
      if (err.writeErrors) {
        const failedIdx = new Set(err.writeErrors.map((e) => e.index));
        results.imported += toInsert.length - failedIdx.size;
        for (const e of err.writeErrors) {
          results.errors.push({
            title: toInsert[e.index]?.title || '(no title)',
            error: e.errmsg || e.message,
          });
        }
      } else {
        // Total failure
        for (const t of toInsert) {
          results.errors.push({ title: t.title, error: err.message });
        }
      }
    }
  }

  // Issue #137 — admin bulk-import is an auditable event; record the
  // aggregate outcome.  Awaited so a failing audit write surfaces as a
  // request failure (security-relevant path).
  if (results.imported > 0 || results.errors.length > 0) {
    await AuditLog.create({
      userId: req.user._id,
      action: 'test.bulk-import',
      targetType: 'Test',
      targetId: req.user._id, // no single targetId; use admin id as a stable handle
      details: {
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors.length,
      },
    });
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
