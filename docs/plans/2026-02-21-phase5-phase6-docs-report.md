# Phase 5 + Phase 6 + Docs + Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the KIIP Study roadmap — add resumable sessions with server-side timer, audit logging for admin actions, PDF export in 4 variants, update all documentation, and write a project report.

**Architecture:** Phase 5 adds a TestSession model that persists answers + remaining time server-side, with auto-save from the client every 30s. An AuditLog middleware wraps admin routes to record mutations. Phase 6 uses pdfkit to generate styled PDFs server-side matching the Japandi design tokens. Docs update brings README, CLAUDE.md, project_context.md, and SETUP_AND_USAGE.md current. Report summarizes all work done across Phases 0-6.

**Tech Stack:** Mongoose 9 (models), Express 5 (routes), pdfkit (PDF generation), React 19 (UI), styled-components 6 (styling)

---

## Phase 5 — Continuity + Audit

### Task 1: Install pdfkit for Phase 6 (do it now to avoid mid-phase npm install)

**Files:**
- Modify: `server/package.json`

**Step 1: Install pdfkit**

Run: `cd server && npm install pdfkit`

**Step 2: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore: install pdfkit for PDF export"
```

---

### Task 2: AuditLog model

**Files:**
- Create: `server/models/AuditLog.js`

**Step 1: Create the AuditLog model**

```javascript
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
        type: String,
        required: true,
        enum: [
            'test.create', 'test.import', 'test.generate', 'test.generate-from-file',
            'test.edit', 'test.delete',
            'flag.resolve', 'flag.dismiss'
        ]
    },
    targetType: { type: String, required: true, enum: ['Test', 'Flag'] },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
});

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
```

**Step 2: Commit**

```bash
git add server/models/AuditLog.js
git commit -m "feat: add AuditLog model for admin action tracking"
```

---

### Task 3: Audit logging in admin routes

**Files:**
- Modify: `server/routes/admin.js` (lines 117-371 — add audit calls after each mutation)

**Step 1: Add audit logging to admin.js**

At top of file, add:
```javascript
const AuditLog = require('../models/AuditLog');
```

After each successful mutation, add an audit log entry. The pattern is:

```javascript
// After test creation/generation/import — add inside the try block after newTest.save():
await AuditLog.create({
    userId: req.user._id,
    action: 'test.generate', // or 'test.import', 'test.generate-from-file', 'test.create'
    targetType: 'Test',
    targetId: newTest._id,
    details: { title: newTest.title }
});

// After test edit (PATCH /tests/:id) — add after test.save():
await AuditLog.create({
    userId: req.user._id,
    action: 'test.edit',
    targetType: 'Test',
    targetId: test._id,
    details: { title: test.title }
});

// After test delete (DELETE /tests/:id) — add after deleteOne():
await AuditLog.create({
    userId: req.user._id,
    action: 'test.delete',
    targetType: 'Test',
    targetId: req.params.id,
    details: { title: test.title }
});

// After flag resolve/dismiss (PATCH /flags/:id) — add after flag.save():
await AuditLog.create({
    userId: req.user._id,
    action: `flag.${flag.status}`, // 'flag.resolve' or 'flag.dismiss'
    targetType: 'Flag',
    targetId: flag._id,
    details: { testId: flag.testId, reason: flag.reason }
});
```

Also add an admin endpoint to view audit logs:

```javascript
// GET /api/admin/audit — view audit log
router.get('/audit', async (req, res) => {
    try {
        const { cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);
        const query = cursor ? { _id: { $lt: cursor } } : {};
        const logs = await AuditLog.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .populate('userId', 'displayName email')
            .lean();
        const hasMore = logs.length > limit;
        if (hasMore) logs.pop();
        const nextCursor = hasMore ? logs[logs.length - 1]._id : null;
        res.json({ logs, nextCursor });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch audit log: ' + err.message });
    }
});
```

**Step 2: Commit**

```bash
git add server/routes/admin.js
git commit -m "feat: add audit logging to all admin mutations"
```

---

### Task 4: TestSession model

**Files:**
- Create: `server/models/TestSession.js`

**Step 1: Create the TestSession model**

```javascript
const mongoose = require('mongoose');

const SessionAnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    selectedOptions: [Number],
    textAnswer: { type: String },
    orderedItems: [String],
    blankAnswers: [String]
}, { _id: false });

const TestSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    mode: { type: String, enum: ['Test', 'Practice'], required: true },
    answers: [SessionAnswerSchema],
    currentQuestion: { type: Number, default: 0 },
    remainingTime: { type: Number, required: true }, // seconds
    status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
    startedAt: { type: Date, default: Date.now },
    lastSavedAt: { type: Date, default: Date.now }
});

// One active session per user per test
TestSessionSchema.index({ userId: 1, testId: 1, status: 1 });
// Find active sessions for dashboard
TestSessionSchema.index({ userId: 1, status: 1, lastSavedAt: -1 });

module.exports = mongoose.model('TestSession', TestSessionSchema);
```

**Step 2: Commit**

```bash
git add server/models/TestSession.js
git commit -m "feat: add TestSession model for resumable sessions"
```

---

### Task 5: Session API routes

**Files:**
- Create: `server/routes/sessions.js`
- Modify: `server/index.js` (mount the routes)

**Step 1: Create session routes**

```javascript
const express = require('express');
const router = express.Router();
const TestSession = require('../models/TestSession');
const Attempt = require('../models/Attempt');
const Test = require('../models/Test');
const { requireAuth } = require('../middleware/auth');
const { scoreQuestion } = require('../utils/scoring');

router.use(requireAuth);

// POST /api/sessions/start — start or resume a session
router.post('/start', async (req, res) => {
    try {
        const { testId, mode } = req.body;
        if (!testId || !mode) {
            return res.status(400).json({ message: 'testId and mode are required' });
        }

        // Check for existing active session
        const existing = await TestSession.findOne({
            userId: req.user._id,
            testId,
            status: 'active'
        });

        if (existing) {
            return res.json({ session: existing, resumed: true });
        }

        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const session = await TestSession.create({
            userId: req.user._id,
            testId,
            mode,
            answers: [],
            currentQuestion: 0,
            remainingTime: 30 * 60 // 30 minutes
        });

        res.status(201).json({ session, resumed: false });
    } catch (err) {
        res.status(500).json({ message: 'Failed to start session: ' + err.message });
    }
});

// PATCH /api/sessions/:id — save progress
router.patch('/:id', async (req, res) => {
    try {
        const session = await TestSession.findOne({
            _id: req.params.id,
            userId: req.user._id,
            status: 'active'
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        const { answers, currentQuestion, remainingTime } = req.body;
        if (answers !== undefined) session.answers = answers;
        if (currentQuestion !== undefined) session.currentQuestion = currentQuestion;
        if (remainingTime !== undefined) session.remainingTime = remainingTime;
        session.lastSavedAt = new Date();

        await session.save();
        res.json({ session });
    } catch (err) {
        res.status(500).json({ message: 'Failed to save session: ' + err.message });
    }
});

// POST /api/sessions/:id/submit — submit session, create attempt, close session
router.post('/:id/submit', async (req, res) => {
    try {
        const session = await TestSession.findOne({
            _id: req.params.id,
            userId: req.user._id,
            status: 'active'
        });

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        const test = await Test.findById(session.testId);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        // Server-side scoring
        let score = 0;
        const scoredAnswers = test.questions.map((q, i) => {
            const sessionAns = session.answers.find(a => a.questionIndex === i);
            const ans = sessionAns || {};
            const isCorrect = scoreQuestion(q, ans);
            if (isCorrect) score++;
            return {
                questionIndex: i,
                selectedOptions: ans.selectedOptions || [],
                textAnswer: ans.textAnswer || '',
                orderedItems: ans.orderedItems || [],
                blankAnswers: ans.blankAnswers || [],
                isCorrect,
                isOverdue: false
            };
        });

        const totalTime = 30 * 60;
        const duration = totalTime - session.remainingTime;
        const overdueTime = session.remainingTime < 0 ? Math.abs(session.remainingTime) : 0;

        const attempt = await Attempt.create({
            testId: session.testId,
            userId: req.user._id,
            score,
            totalQuestions: test.questions.length,
            duration,
            overdueTime,
            answers: scoredAnswers,
            mode: session.mode
        });

        // Close the session
        session.status = 'completed';
        await session.save();

        res.json({
            attempt,
            score,
            total: test.questions.length,
            percentage: Math.round((score / test.questions.length) * 100)
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit session: ' + err.message });
    }
});

// GET /api/sessions/active — get user's active sessions for dashboard
router.get('/active', async (req, res) => {
    try {
        const sessions = await TestSession.find({
            userId: req.user._id,
            status: 'active'
        })
        .sort({ lastSavedAt: -1 })
        .limit(5)
        .populate('testId', 'title category level unit')
        .lean();

        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch sessions: ' + err.message });
    }
});

// DELETE /api/sessions/:id — abandon session
router.delete('/:id', async (req, res) => {
    try {
        const session = await TestSession.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, status: 'active' },
            { status: 'abandoned' },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        res.json({ message: 'Session abandoned' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to abandon session: ' + err.message });
    }
});

module.exports = router;
```

**Step 2: Mount in server/index.js**

After the flags route mount, add:
```javascript
const sessionRoutes = require('./routes/sessions');
// ...
app.use('/api/sessions', sessionRoutes);
```

**Step 3: Commit**

```bash
git add server/routes/sessions.js server/index.js
git commit -m "feat: add session API routes (start, save, submit, active, abandon)"
```

---

### Task 6: TestTaker session integration

**Files:**
- Modify: `client/src/pages/TestTaker.jsx`

**Step 1: Add session state and logic to TestTaker**

Key changes:
1. Add `sessionId` state variable
2. On mount: call `POST /api/sessions/start` instead of just fetching the test — if resumed, restore answers + timeLeft + currentQ
3. Add auto-save effect: every 30s, `PATCH /api/sessions/:id` with current answers, currentQ, remainingTime
4. Modify handleSubmit: call `POST /api/sessions/:id/submit` instead of `POST /api/tests/:id/attempt`
5. On exit/abandon: call `DELETE /api/sessions/:id`

The changes should be:

```javascript
// New state
const [sessionId, setSessionId] = useState(null);

// Modified fetch effect — start session instead of just fetching test
useEffect(() => {
    const initSession = async () => {
        try {
            const testRes = await api.get(`/api/tests/${id}`);
            setTest(testRes.data);

            // If user is logged in, use sessions
            if (user) {
                const sessionRes = await api.post('/api/sessions/start', {
                    testId: id,
                    mode
                });
                const { session, resumed } = sessionRes.data;
                setSessionId(session._id);

                if (resumed) {
                    // Restore session state
                    const restoredAnswers = {};
                    session.answers.forEach(a => {
                        restoredAnswers[a.questionIndex] = a;
                    });
                    setAnswers(restoredAnswers);
                    setCurrentQ(session.currentQuestion);
                    setTimeLeft(session.remainingTime);
                }
            }
        } catch (err) {
            setError('Could not load the test.');
        }
    };
    initSession();
}, [id]); // mode is set before this runs

// Auto-save effect (every 30s)
useEffect(() => {
    if (!sessionId || isSubmitted) return;
    const interval = setInterval(() => {
        const answerArray = Object.entries(answers).map(([idx, ans]) => ({
            questionIndex: parseInt(idx),
            ...ans
        }));
        api.patch(`/api/sessions/${sessionId}`, {
            answers: answerArray,
            currentQuestion: currentQ,
            remainingTime: timeLeft
        }).catch(() => {}); // silent fail
    }, 30000);
    return () => clearInterval(interval);
}, [sessionId, answers, currentQ, timeLeft, isSubmitted]);

// Modified handleSubmit — use session submit
const handleSubmit = async () => {
    if (isSubmitted) return;
    // ... existing scoring logic for immediate UI feedback ...
    setIsSubmitted(true);

    try {
        if (sessionId) {
            // Save final state then submit
            const answerArray = Object.entries(answers).map(([idx, ans]) => ({
                questionIndex: parseInt(idx),
                ...ans
            }));
            await api.patch(`/api/sessions/${sessionId}`, {
                answers: answerArray,
                currentQuestion: currentQ,
                remainingTime: timeLeft
            });
            await api.post(`/api/sessions/${sessionId}/submit`);
        } else {
            // Fallback for non-authenticated users
            await api.post(`/api/tests/${id}/attempt`, { /* existing payload */ });
        }
    } catch (err) {
        console.error('Failed to save attempt:', err);
    }
};
```

**Step 2: Commit**

```bash
git add client/src/pages/TestTaker.jsx
git commit -m "feat: integrate resumable sessions into TestTaker with auto-save"
```

---

### Task 7: Home page active sessions display

**Files:**
- Modify: `client/src/pages/Home.jsx`

**Step 1: Add active sessions section to Home**

In the dashboard section (around line 554), add a fetch for active sessions and display them as "Continue" cards:

```javascript
// New state
const [activeSessions, setActiveSessions] = useState([]);

// Fetch active sessions
useEffect(() => {
    if (user) {
        api.get('/api/sessions/active')
            .then(res => setActiveSessions(res.data.sessions))
            .catch(() => {});
    }
}, [user]);

// Render active sessions as "Continue" cards above the test grid
// Each card shows: test title, mode, remaining time, "Continue" button linking to /test/:testId
```

Add styled components for the session card and render them before the test grid. Each card links to `/test/:testId` which will auto-resume via the session start endpoint.

**Step 2: Commit**

```bash
git add client/src/pages/Home.jsx
git commit -m "feat: show active sessions on home dashboard for quick resume"
```

---

### Task 8: Phase 5 verification and commit

**Step 1: Build verification**

Run: `cd client && npm run build`
Expected: Success

Run: `cd client && npm run lint`
Expected: No errors

**Step 2: Update IMPLEMENTATION_PLAN.md**

Mark Phase 5 as complete with checkboxes.

**Step 3: Commit**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 5 complete in implementation plan"
```

---

## Phase 6 — PDF Exports

### Task 9: PDF generator utility with Japandi styling

**Files:**
- Create: `server/utils/pdfGenerator.js`

**Step 1: Create the PDF generator utility**

Build a utility that creates PDFs using pdfkit with Japandi design tokens. Key functions:

```javascript
const PDFDocument = require('pdfkit');

// Japandi design tokens (matching client/src/theme/tokens.js)
const COLORS = {
    canvas: '#F7F2E8',
    surface: '#FFFFFF',
    textPrimary: '#1F2328',
    textMuted: '#5B5F64',
    textFaint: '#7B8086',
    clay: '#A0634A',
    moss: '#657655',
    indigo: '#2A536D',
    success: '#2F6B4F',
    danger: '#B43A3A',
    borderSubtle: '#E2DDD4',
    correctBg: '#EDF5E9',
    wrongBg: '#FAEDED'
};

function createPdfDoc() {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 50, right: 50 },
        bufferPages: true
    });
    return doc;
}

function addHeader(doc, title, subtitle) { /* ... */ }
function addQuestion(doc, question, index, options) { /* ... */ }
function addFooter(doc) { /* ... */ }
function addPageNumbers(doc) { /* ... */ }

module.exports = { createPdfDoc, addHeader, addQuestion, addFooter, addPageNumbers, COLORS };
```

The utility handles: page headers, question rendering for all 5 types, option circles/checkboxes, answer key marks, Japandi color scheme, page numbers, and page breaks.

**Step 2: Commit**

```bash
git add server/utils/pdfGenerator.js
git commit -m "feat: add PDF generator utility with Japandi styling"
```

---

### Task 10: PDF API routes (all 4 variants)

**Files:**
- Create: `server/routes/pdf.js`
- Modify: `server/index.js` (mount routes)

**Step 1: Create PDF routes**

```javascript
const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const { requireAuth } = require('../middleware/auth');
const { createPdfDoc, addHeader, addQuestion, addFooter, addPageNumbers, COLORS } = require('../utils/pdfGenerator');
const { scoreQuestion } = require('../utils/scoring');

// GET /api/pdf/test/:id?variant=blank|answerKey
router.get('/test/:id', requireAuth, async (req, res) => {
    try {
        const test = await Test.findById(req.params.id).lean();
        if (!test) return res.status(404).json({ message: 'Test not found' });

        const variant = req.query.variant || 'blank';
        const doc = createPdfDoc();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${test.title} - ${variant}.pdf"`);
        doc.pipe(res);

        addHeader(doc, test.title, variant === 'blank' ? 'Practice Test' : 'Answer Key');

        test.questions.forEach((q, i) => {
            addQuestion(doc, q, i, { showAnswers: variant === 'answerKey' });
        });

        addPageNumbers(doc);
        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'PDF generation failed: ' + err.message });
    }
});

// GET /api/pdf/attempt/:attemptId?variant=student|report
router.get('/attempt/:attemptId', requireAuth, async (req, res) => {
    try {
        const attempt = await Attempt.findById(req.params.attemptId).lean();
        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        const test = await Test.findById(attempt.testId).lean();
        if (!test) return res.status(404).json({ message: 'Test not found' });

        const variant = req.query.variant || 'student';
        const doc = createPdfDoc();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${test.title} - ${variant}.pdf"`);
        doc.pipe(res);

        // Header with score summary
        const pct = Math.round((attempt.score / attempt.totalQuestions) * 100);
        addHeader(doc, test.title, `${variant === 'report' ? 'Attempt Report' : 'Your Answers'} — ${attempt.score}/${attempt.totalQuestions} (${pct}%)`);

        if (variant === 'report') {
            // Add timing info
            const mins = Math.floor(attempt.duration / 60);
            const secs = attempt.duration % 60;
            doc.fontSize(11).fillColor(COLORS.textMuted)
               .text(`Duration: ${mins}m ${secs}s | Mode: ${attempt.mode}`, { align: 'left' });
            if (attempt.overdueTime > 0) {
                doc.text(`Overdue: ${attempt.overdueTime}s`, { align: 'left' });
            }
            doc.moveDown();
        }

        test.questions.forEach((q, i) => {
            const answer = attempt.answers.find(a => a.questionIndex === i);
            addQuestion(doc, q, i, {
                showAnswers: true,
                userAnswer: answer,
                showExplanation: variant === 'report'
            });
        });

        addPageNumbers(doc);
        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'PDF generation failed: ' + err.message });
    }
});

module.exports = router;
```

**Step 2: Mount in server/index.js**

```javascript
const pdfRoutes = require('./routes/pdf');
app.use('/api/pdf', pdfRoutes);
```

**Step 3: Commit**

```bash
git add server/routes/pdf.js server/index.js
git commit -m "feat: add PDF export API routes (blank, answerKey, student, report)"
```

---

### Task 11: Frontend PDF export buttons

**Files:**
- Modify: `client/src/pages/TestTaker.jsx` (add export buttons to result screen)
- Modify: `client/src/pages/Home.jsx` (add export button to test cards)

**Step 1: Add PDF export buttons to TestTaker result screen**

After the score display in the submitted state (around the result section), add:

```jsx
// Styled component
const ExportRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  flex-wrap: wrap;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const ExportLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  text-decoration: none;
  background: ${({ theme }) => theme.colors.bg.surface};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

// In the result/submitted JSX section:
<ExportRow>
  <ExportLink href={`${API_BASE_URL}/api/pdf/test/${id}?variant=blank`} target="_blank">
    Blank Test PDF
  </ExportLink>
  <ExportLink href={`${API_BASE_URL}/api/pdf/test/${id}?variant=answerKey`} target="_blank">
    Answer Key PDF
  </ExportLink>
  {attemptId && (
    <>
      <ExportLink href={`${API_BASE_URL}/api/pdf/attempt/${attemptId}?variant=student`} target="_blank">
        My Answers PDF
      </ExportLink>
      <ExportLink href={`${API_BASE_URL}/api/pdf/attempt/${attemptId}?variant=report`} target="_blank">
        Full Report PDF
      </ExportLink>
    </>
  )}
</ExportRow>
```

Note: The attemptId needs to be captured from the submit response. Add `const [attemptId, setAttemptId] = useState(null)` and set it after submit.

**Step 2: Add blank/answerKey export to Home test cards**

In each test card's action area, add small export links visible to all authenticated users.

**Step 3: Commit**

```bash
git add client/src/pages/TestTaker.jsx client/src/pages/Home.jsx
git commit -m "feat: add PDF export buttons to test results and home cards"
```

---

### Task 12: Phase 6 verification and commit

**Step 1: Build verification**

Run: `cd client && npm run build`
Expected: Success

Run: `cd client && npm run lint`
Expected: No errors

**Step 2: Update IMPLEMENTATION_PLAN.md**

Mark Phase 6 as complete.

**Step 3: Commit**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 6 complete in implementation plan"
```

---

## Documentation Updates

### Task 13: Update all documentation files

**Files:**
- Modify: `CLAUDE.md` — update API endpoints, schemas, dependencies, env vars to reflect Phases 5-6
- Modify: `IMPLEMENTATION_PLAN.md` — mark all phases complete, update acceptance criteria
- Modify: `additionalContext/project_context.md` — update current state, data model, features
- Modify: `additionalContext/SETUP_AND_USAGE.md` — update API reference, env vars, features list
- Modify: `.env.example` — ensure all env vars documented

Key updates:
1. Add TestSession and AuditLog to schema docs
2. Add session + PDF endpoints to API reference
3. Add pdfkit to dependencies list
4. Update "Current state" descriptions to reflect completed app
5. Update acceptance criteria as met

**Step 1: Update each file**

Read each file, update sections to reflect the completed state of all 6 phases.

**Step 2: Commit**

```bash
git add CLAUDE.md IMPLEMENTATION_PLAN.md additionalContext/project_context.md additionalContext/SETUP_AND_USAGE.md .env.example
git commit -m "docs: update all documentation to reflect completed Phases 0-6"
```

---

### Task 14: Write project report

**Files:**
- Create: `docs/PROJECT_REPORT.md`

**Step 1: Write comprehensive report**

The report should cover:

1. **Executive Summary** — what was built, tech stack, deployment status
2. **Phase-by-Phase Summary** — what each phase delivered, key decisions
3. **Architecture Overview** — server structure, client structure, data flow
4. **Feature List** — complete feature inventory with status
5. **Data Model** — all collections and their relationships
6. **API Reference** — all endpoints grouped by domain
7. **Design System** — Japandi tokens, component patterns
8. **Testing** — Playwright coverage, what's tested
9. **Deployment** — Docker Compose setup, CI/CD pipeline
10. **Future Considerations** — what's not built, potential improvements (excluding spaced repetition)

**Step 2: Commit**

```bash
git add docs/PROJECT_REPORT.md
git commit -m "docs: add comprehensive project report covering Phases 0-6"
```

---

## Summary

| Task | Phase | Description |
|------|-------|-------------|
| 1 | 5 | Install pdfkit |
| 2 | 5 | AuditLog model |
| 3 | 5 | Audit logging in admin routes |
| 4 | 5 | TestSession model |
| 5 | 5 | Session API routes |
| 6 | 5 | TestTaker session integration |
| 7 | 5 | Home page active sessions |
| 8 | 5 | Phase 5 verification |
| 9 | 6 | PDF generator utility |
| 10 | 6 | PDF API routes |
| 11 | 6 | Frontend PDF export buttons |
| 12 | 6 | Phase 6 verification |
| 13 | docs | Update all documentation |
| 14 | docs | Write project report |

**Estimated tasks:** 14
**Dependencies:** Tasks 1-8 sequential (Phase 5), Tasks 9-12 sequential (Phase 6), Tasks 13-14 after both phases complete
**Parallelizable:** Phase 5 tasks 2+4 (models), Phase 6 tasks 9+10 partially
