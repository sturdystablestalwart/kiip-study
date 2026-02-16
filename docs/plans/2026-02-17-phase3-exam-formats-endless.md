# Phase 3 — Exam-Accurate Formats + Endless Mode: Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support all 5 question types (MCQ single, MCQ multiple, short answer, ordering, fill-in-the-blank) with per-type scoring, add missed-only review, and build an endless practice mode drawing from the full test library.

**Architecture:** Extend QuestionSchema with type-specific fields. Build a `QuestionRenderer` component that switches on question type. Add a separate `EndlessMode.jsx` page that fetches random questions via a new API endpoint. Scoring logic moves to a shared utility used by both TestTaker and EndlessMode.

**Tech Stack:** Mongoose 9, Express 5, React 19, styled-components 6, native HTML Drag and Drop API (no new dependencies)

---

## Task 1: Migrate Question Type Field

**Files:**
- Create: `server/scripts/migrateQuestionTypes.js`
- Modify: `server/models/Test.js:8-14`

**Step 1: Write migration script**

Create `server/scripts/migrateQuestionTypes.js`:

```js
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app');
  console.log('Connected to MongoDB');

  const result = await mongoose.connection.db.collection('tests').updateMany(
    { 'questions.type': 'multiple-choice' },
    { $set: { 'questions.$[elem].type': 'mcq-single' } },
    { arrayFilters: [{ 'elem.type': 'multiple-choice' }] }
  );

  console.log(`Updated ${result.modifiedCount} test documents`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

**Step 2: Update QuestionSchema type field**

In `server/models/Test.js`, change the `type` field on QuestionSchema from:
```js
type: { type: String, default: 'multiple-choice' }
```
to:
```js
type: { type: String, enum: ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'], default: 'mcq-single' }
```

**Step 3: Add new optional fields to QuestionSchema**

Add after the `type` field in QuestionSchema:
```js
acceptedAnswers: [{ type: String }],
correctOrder: [{ type: Number }],
blanks: [{
  acceptedAnswers: [{ type: String }]
}]
```

**Step 4: Run migration**

Run: `cd server && node scripts/migrateQuestionTypes.js`
Expected: "Updated N test documents" (N >= 0)

**Step 5: Verify and commit**

Run: `cd client && npm run build`
Expected: SUCCESS

```bash
git add server/models/Test.js server/scripts/migrateQuestionTypes.js
git commit -m "feat: add question type enum and type-specific schema fields"
```

---

## Task 2: Update AnswerSchema + Attempt Model

**Files:**
- Modify: `server/models/Attempt.js:3-8` (AnswerSchema)
- Modify: `server/models/Attempt.js:11` (mode enum)

**Step 1: Update AnswerSchema**

Replace the current AnswerSchema in `server/models/Attempt.js` with:

```js
const AnswerSchema = new mongoose.Schema({
    questionIndex: { type: Number, required: true },
    selectedOptions: [{ type: Number }],
    textAnswer: { type: String },
    orderedItems: [{ type: Number }],
    blankAnswers: [{ type: String }],
    isCorrect: { type: Boolean, required: true },
    isOverdue: { type: Boolean, default: false }
});
```

Note: `selectedOption` (singular Number) is removed. Old attempts with this field still exist in the DB but won't break reads — Mongoose just ignores unknown fields in lean queries.

**Step 2: Update mode enum**

Change the mode field:
```js
mode: { type: String, enum: ['Practice', 'Test', 'Endless'], default: 'Test' }
```

**Step 3: Make testId optional for Endless mode**

Change testId from `required: true` to just a ref:
```js
testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' }
```

Add a new field for tracking source questions in endless mode:
```js
sourceQuestions: [{
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  questionIndex: { type: Number }
}]
```

**Step 4: Verify and commit**

Run: `cd client && npm run build`
Expected: SUCCESS

```bash
git add server/models/Attempt.js
git commit -m "feat: update AnswerSchema for multi-type support and Endless mode"
```

---

## Task 3: Shared Scoring Utility

**Files:**
- Create: `server/utils/scoring.js`
- Create: `client/src/utils/scoring.js`

**Step 1: Create server-side scoring utility**

Create `server/utils/scoring.js`:

```js
function scoreQuestion(question, answer) {
  const type = question.type || 'mcq-single';

  switch (type) {
    case 'mcq-single': {
      const selected = answer.selectedOptions?.[0];
      if (selected == null) return false;
      return question.options[selected]?.isCorrect === true;
    }
    case 'mcq-multiple': {
      const selected = new Set(answer.selectedOptions || []);
      const correct = new Set(
        question.options
          .map((opt, i) => opt.isCorrect ? i : -1)
          .filter(i => i >= 0)
      );
      if (selected.size !== correct.size) return false;
      for (const idx of selected) {
        if (!correct.has(idx)) return false;
      }
      return true;
    }
    case 'short-answer': {
      const text = (answer.textAnswer || '').trim().toLowerCase();
      if (!text) return false;
      return (question.acceptedAnswers || []).some(
        a => a.trim().toLowerCase() === text
      );
    }
    case 'ordering': {
      const submitted = answer.orderedItems || [];
      const correct = question.correctOrder || [];
      if (submitted.length !== correct.length) return false;
      return submitted.every((val, i) => val === correct[i]);
    }
    case 'fill-in-the-blank': {
      const submitted = answer.blankAnswers || [];
      const blanks = question.blanks || [];
      if (submitted.length !== blanks.length) return false;
      return blanks.every((blank, i) => {
        const userAnswer = (submitted[i] || '').trim().toLowerCase();
        return (blank.acceptedAnswers || []).some(
          a => a.trim().toLowerCase() === userAnswer
        );
      });
    }
    default:
      return false;
  }
}

module.exports = { scoreQuestion };
```

**Step 2: Create client-side scoring utility (identical logic)**

Create `client/src/utils/scoring.js`:

```js
export function scoreQuestion(question, answer) {
  const type = question.type || 'mcq-single';

  switch (type) {
    case 'mcq-single': {
      const selected = answer.selectedOptions?.[0];
      if (selected == null) return false;
      return question.options[selected]?.isCorrect === true;
    }
    case 'mcq-multiple': {
      const selected = new Set(answer.selectedOptions || []);
      const correct = new Set(
        question.options
          .map((opt, i) => opt.isCorrect ? i : -1)
          .filter(i => i >= 0)
      );
      if (selected.size !== correct.size) return false;
      for (const idx of selected) {
        if (!correct.has(idx)) return false;
      }
      return true;
    }
    case 'short-answer': {
      const text = (answer.textAnswer || '').trim().toLowerCase();
      if (!text) return false;
      return (question.acceptedAnswers || []).some(
        a => a.trim().toLowerCase() === text
      );
    }
    case 'ordering': {
      const submitted = answer.orderedItems || [];
      const correct = question.correctOrder || [];
      if (submitted.length !== correct.length) return false;
      return submitted.every((val, i) => val === correct[i]);
    }
    case 'fill-in-the-blank': {
      const submitted = answer.blankAnswers || [];
      const blanks = question.blanks || [];
      if (submitted.length !== blanks.length) return false;
      return blanks.every((blank, i) => {
        const userAnswer = (submitted[i] || '').trim().toLowerCase();
        return (blank.acceptedAnswers || []).some(
          a => a.trim().toLowerCase() === userAnswer
        );
      });
    }
    default:
      return false;
  }
}
```

**Step 3: Verify and commit**

Run: `cd client && npm run build`
Expected: SUCCESS

```bash
git add server/utils/scoring.js client/src/utils/scoring.js
git commit -m "feat: add shared scoring utility for all question types"
```

---

## Task 4: Per-Type Question Renderer Components

**Files:**
- Create: `client/src/components/question-types/MCQSingle.jsx`
- Create: `client/src/components/question-types/MCQMultiple.jsx`
- Create: `client/src/components/question-types/ShortAnswer.jsx`
- Create: `client/src/components/question-types/Ordering.jsx`
- Create: `client/src/components/question-types/FillInTheBlank.jsx`
- Create: `client/src/components/QuestionRenderer.jsx`

This is the largest task. Each sub-component receives these props:

```
question       - the question object
answer         - current answer data (or null)
onAnswer       - callback to update answer
showFeedback   - boolean, show correct/incorrect states
disabled       - boolean, prevent interaction
```

**Step 1: Create MCQSingle.jsx**

This extracts the current option-button logic from TestTaker into a standalone component. Uses the existing `OptionButton` styled component pattern.

Props: `{ question, answer, onAnswer, showFeedback, disabled }`
- `answer` shape: `{ selectedOptions: [Number] }`
- `onAnswer({ selectedOptions: [idx] })` on click

**Step 2: Create MCQMultiple.jsx**

Similar to MCQSingle but clicking an option toggles it (add/remove from `selectedOptions` array). Shows a checkbox indicator (e.g., `[x]` prefix) for selected items. Includes "Select all that apply" hint text below the question.

Props: same as MCQSingle
- `answer` shape: `{ selectedOptions: [Number, Number, ...] }`
- `onAnswer({ selectedOptions: [...toggled] })` on click

**Step 3: Create ShortAnswer.jsx**

Renders a text input below the question text. The answer is confirmed on blur or Enter keypress.

Props: same signature
- `answer` shape: `{ textAnswer: String }`
- `onAnswer({ textAnswer: value })` on blur/Enter
- When `showFeedback` is true, show whether the answer matches any `acceptedAnswers` and display the list of accepted answers

**Step 4: Create Ordering.jsx**

Renders the options as a sortable list. Each item has up/down arrow buttons. Also supports native HTML drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`).

Props: same signature
- `answer` shape: `{ orderedItems: [Number, Number, ...] }` (indices into `question.options`)
- Initial order: `[0, 1, 2, ...]` (original order)
- `onAnswer({ orderedItems: newOrder })` after each reorder
- When `showFeedback`, highlight items in correct vs incorrect positions

**Step 5: Create FillInTheBlank.jsx**

Splits `question.text` on `___` markers. Renders text segments with inline `<input>` elements between them. Each input maps to a blank index.

Props: same signature
- `answer` shape: `{ blankAnswers: [String, String, ...] }`
- `onAnswer({ blankAnswers: [...values] })` on input change
- When `showFeedback`, show correct/incorrect per blank with accepted answers

**Step 6: Create QuestionRenderer.jsx**

A switch component:

```jsx
import MCQSingle from './question-types/MCQSingle';
import MCQMultiple from './question-types/MCQMultiple';
import ShortAnswer from './question-types/ShortAnswer';
import Ordering from './question-types/Ordering';
import FillInTheBlank from './question-types/FillInTheBlank';

function QuestionRenderer({ question, answer, onAnswer, showFeedback, disabled }) {
  const type = question.type || 'mcq-single';
  const props = { question, answer, onAnswer, showFeedback, disabled };

  switch (type) {
    case 'mcq-single':
    case 'multiple-choice':  // backward compat
      return <MCQSingle {...props} />;
    case 'mcq-multiple':
      return <MCQMultiple {...props} />;
    case 'short-answer':
      return <ShortAnswer {...props} />;
    case 'ordering':
      return <Ordering {...props} />;
    case 'fill-in-the-blank':
      return <FillInTheBlank {...props} />;
    default:
      return <MCQSingle {...props} />;
  }
}

export default QuestionRenderer;
```

**Step 7: Verify and commit**

Run: `cd client && npm run build`
Expected: SUCCESS (components are created but not yet used)

```bash
git add client/src/components/question-types/ client/src/components/QuestionRenderer.jsx
git commit -m "feat: add per-type question renderer components"
```

---

## Task 5: Integrate QuestionRenderer into TestTaker + Missed-Only Review

**Files:**
- Modify: `client/src/pages/TestTaker.jsx`

**Step 1: Replace inline option rendering with QuestionRenderer**

In TestTaker, replace the `<OptionsGrid>` + `<OptionButton>` + `<ExplanationPanel>` block (lines ~669-688) with:

```jsx
<QuestionRenderer
  question={currentQuestion}
  answer={currentAnswer}
  onAnswer={(answerData) => {
    if (isSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [currentQ]: { ...answerData, overdue: timerExpired }
    }));
  }}
  showFeedback={showFeedback}
  disabled={isSubmitted}
/>
```

**Step 2: Update answer data shape**

The `answers` state object now stores type-specific data:
- MCQ single: `{ selectedOptions: [idx], overdue: bool }`
- MCQ multiple: `{ selectedOptions: [idx1, idx2], overdue: bool }`
- Short answer: `{ textAnswer: 'string', overdue: bool }`
- Ordering: `{ orderedItems: [2, 0, 1, 3], overdue: bool }`
- Fill-in-the-blank: `{ blankAnswers: ['a', 'b'], overdue: bool }`

**Step 3: Update handleSubmit scoring**

Replace the inline scoring in `handleSubmit` (lines ~551-563) to use the shared `scoreQuestion` utility:

```js
import { scoreQuestion } from '../utils/scoring';

// In handleSubmit:
const submissionAnswers = test.questions.map((q, idx) => {
  const ans = answers[idx];
  const isCorrect = ans ? scoreQuestion(q, ans) : false;
  if (isCorrect) correctCount++;
  return {
    questionIndex: idx,
    selectedOptions: ans?.selectedOptions,
    textAnswer: ans?.textAnswer,
    orderedItems: ans?.orderedItems,
    blankAnswers: ans?.blankAnswers,
    isCorrect,
    isOverdue: ans?.overdue ?? false
  };
});
```

**Step 4: Update keyboard shortcuts**

The 1-4 keyboard shortcuts should only fire for MCQ question types. Add a guard:

```js
const qType = question.type || 'mcq-single';
if ((qType === 'mcq-single' || qType === 'mcq-multiple' || qType === 'multiple-choice') && num >= 1 && num <= question.options.length) {
  // existing logic
}
```

**Step 5: Add missed-only review mode**

Add state:
```js
const [reviewMode, setReviewMode] = useState(false);
```

Compute missed questions:
```js
const missedIndices = isSubmitted
  ? test.questions.map((q, i) => {
      const ans = answers[i];
      return (!ans || !scoreQuestion(q, ans)) ? i : -1;
    }).filter(i => i >= 0)
  : [];
```

In the result card, add a button:
```jsx
{missedIndices.length > 0 && (
  <NavButton $primary onClick={() => { setReviewMode(true); setCurrentQ(missedIndices[0]); }}>
    Review {missedIndices.length} missed question{missedIndices.length > 1 ? 's' : ''}
  </NavButton>
)}
```

When `reviewMode` is true:
- Navigation only steps through `missedIndices`
- Question numbers show original numbering but only missed questions appear
- "Back to results" button exits review mode: `setReviewMode(false)`

**Step 6: Verify and commit**

Run: `cd client && npm run build`
Run: `cd client && npm run lint`
Expected: both pass

```bash
git add client/src/pages/TestTaker.jsx
git commit -m "feat: integrate QuestionRenderer and add missed-only review"
```

---

## Task 6: Update Server-Side Scoring + Attempt Endpoint

**Files:**
- Modify: `server/routes/tests.js:426-437` (POST /:id/attempt)

**Step 1: Add server-side score validation**

The current `POST /:id/attempt` blindly trusts the client's `score`. Add server-side verification:

```js
const { scoreQuestion } = require('../utils/scoring');

router.post('/:id/attempt', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Server-side score verification
        let serverScore = 0;
        const verifiedAnswers = (req.body.answers || []).map((ans, idx) => {
            const question = test.questions[idx];
            if (!question) return { ...ans, isCorrect: false };
            const isCorrect = scoreQuestion(question, ans);
            if (isCorrect) serverScore++;
            return { ...ans, isCorrect };
        });

        const attempt = new Attempt({
            testId: req.params.id,
            score: serverScore,
            totalQuestions: test.questions.length,
            duration: req.body.duration,
            overdueTime: req.body.overdueTime || 0,
            answers: verifiedAnswers,
            mode: req.body.mode || 'Test'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: 'Failed to save attempt: ' + err.message });
    }
});
```

**Step 2: Verify and commit**

```bash
git add server/routes/tests.js
git commit -m "feat: add server-side score verification for all question types"
```

---

## Task 7: Endless Mode API Endpoints

**Files:**
- Modify: `server/routes/tests.js` (add two new routes before `/:id`)

**Step 1: Add GET /endless endpoint**

Place BEFORE the `/:id` route (after `/recent-attempts`):

```js
// GET random questions for endless mode
router.get('/endless', async (req, res) => {
    try {
        const { level, unit, exclude, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 20);

        // Parse excluded question identifiers (format: "testId:qIdx,testId:qIdx")
        const excludeSet = new Set((exclude || '').split(',').filter(Boolean));

        // Build match for tests
        const match = {};
        if (level) match.level = level;
        if (unit) match.unit = unit;

        // Fetch matching tests with their questions
        const tests = await Test.find(match, { questions: 1, title: 1 }).lean();

        // Flatten all questions with source references
        let pool = [];
        for (const test of tests) {
            for (let i = 0; i < test.questions.length; i++) {
                const key = `${test._id}:${i}`;
                if (!excludeSet.has(key)) {
                    pool.push({
                        ...test.questions[i],
                        _sourceTestId: test._id,
                        _sourceIndex: i,
                        _sourceKey: key
                    });
                }
            }
        }

        // Shuffle and pick `limit` questions (Fisher-Yates)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const selected = pool.slice(0, limit);

        res.json({
            questions: selected,
            remaining: pool.length - selected.length
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch endless questions: ' + err.message });
    }
});
```

**Step 2: Add POST /endless/attempt endpoint**

Place after GET /endless:

```js
// POST save endless mode chunk attempt
router.post('/endless/attempt', async (req, res) => {
    try {
        const { answers, duration, sourceQuestions } = req.body;
        if (!answers || !answers.length) {
            return res.status(400).json({ message: 'No answers provided' });
        }

        let score = 0;
        const verifiedAnswers = answers.map(ans => {
            if (ans.isCorrect) score++;
            return ans;
        });

        const attempt = new Attempt({
            testId: null,
            score,
            totalQuestions: answers.length,
            duration: duration || 0,
            overdueTime: 0,
            answers: verifiedAnswers,
            sourceQuestions: sourceQuestions || [],
            mode: 'Endless'
        });
        const savedAttempt = await attempt.save();
        res.status(201).json(savedAttempt);
    } catch (err) {
        res.status(400).json({ message: 'Failed to save endless attempt: ' + err.message });
    }
});
```

**Step 3: Verify and commit**

```bash
git add server/routes/tests.js
git commit -m "feat: add endless mode API endpoints (GET random questions, POST chunk attempt)"
```

---

## Task 8: EndlessMode Page Component

**Files:**
- Create: `client/src/pages/EndlessMode.jsx`
- Modify: `client/src/App.jsx:143-147` (add route)

**Step 1: Create EndlessMode.jsx**

Key states:
- `questions` — current batch of questions
- `currentIdx` — index within current batch
- `answers` — accumulated answers for current chunk
- `totalAnswered` — running total across all chunks
- `totalCorrect` — running total correct
- `excludeKeys` — rolling window of answered question keys (max 30)
- `filter` — `{ level, unit }` selected at start
- `started` — boolean, false shows filter/start screen
- `loading` — fetching next batch

Flow:
1. Start screen: level/unit dropdowns + "Start Endless" button
2. On start: fetch first batch from `GET /api/tests/endless?level=&unit=&limit=10`
3. Show one question at a time using `QuestionRenderer` in Practice mode (instant feedback)
4. After answering, user clicks "Next" to advance
5. Every 10 questions: auto-submit chunk via `POST /api/tests/endless/attempt`, then fetch next batch
6. Stats bar at top: total answered, total correct, running accuracy %
7. "End Session" button always visible — submits remaining answers, shows final summary

Uses shared components: `QuestionRenderer`, `scoreQuestion` utility, styled-components with theme tokens.

**Step 2: Add route in App.jsx**

Add import:
```js
import EndlessMode from './pages/EndlessMode';
```

Add route inside `<Routes>`:
```jsx
<Route path="/endless" element={<EndlessMode />} />
```

**Step 3: Verify and commit**

Run: `cd client && npm run build`
Run: `cd client && npm run lint`
Expected: both pass

```bash
git add client/src/pages/EndlessMode.jsx client/src/App.jsx
git commit -m "feat: add EndlessMode page with batch fetching and chunk submissions"
```

---

## Task 9: Add Endless Mode Entry Point on Home Page

**Files:**
- Modify: `client/src/pages/Home.jsx`

**Step 1: Add Endless Mode card**

After the "Recent Attempts" section and before the "All Tests" filter bar, add an Endless Mode entry card:

```jsx
<DashboardSection>
  <EndlessCard to="/endless">
    <EndlessIcon>&#x221E;</EndlessIcon>
    <EndlessInfo>
      <EndlessTitle>Endless Practice</EndlessTitle>
      <EndlessMeta>Random questions from the full library. No timer, no limits.</EndlessMeta>
    </EndlessInfo>
  </EndlessCard>
</DashboardSection>
```

**Step 2: Add styled components**

Create `EndlessCard` (Link-based), `EndlessIcon`, `EndlessInfo`, `EndlessTitle`, `EndlessMeta` styled components matching the Japandi design tokens. The card should use the moss accent color to differentiate from the clay-colored continue card.

**Step 3: Verify and commit**

Run: `cd client && npm run build`
Run: `cd client && npm run lint`
Expected: both pass

```bash
git add client/src/pages/Home.jsx
git commit -m "feat: add Endless Mode entry card to Home dashboard"
```

---

## Task 10: Update Recent Attempts for Endless Mode

**Files:**
- Modify: `server/routes/tests.js` (GET /recent-attempts)
- Modify: `client/src/pages/Home.jsx` (recent attempts display)

**Step 1: Handle null testId in recent-attempts endpoint**

Endless attempts have `testId: null`. Update the enrichment logic:

```js
const enriched = attempts.map(a => ({
  ...a,
  test: a.testId
    ? (testMap[a.testId.toString()] || { title: 'Deleted test' })
    : { title: 'Endless Practice' }
}));
```

**Step 2: Update Home page recent attempts display**

In the `RecentChip` rendering, handle endless attempts (no `testId` means link to `/endless` instead of `/test/:id`):

```jsx
<RecentChip
  key={attempt._id || i}
  to={attempt.testId ? `/test/${attempt.testId}` : '/endless'}
>
```

**Step 3: Verify and commit**

Run: `cd client && npm run build`
Expected: SUCCESS

```bash
git add server/routes/tests.js client/src/pages/Home.jsx
git commit -m "feat: handle Endless mode attempts in recent-attempts display"
```

---

## Task 11: Update AI Generation Prompt for Question Types

**Files:**
- Modify: `server/routes/tests.js:30-64` (parseTextWithLLM prompt)

**Step 1: Update the Gemini prompt**

Update the prompt in `parseTextWithLLM` to support generating different question types. The AI should default to `mcq-single` but can generate other types when the source material warrants it. Update the JSON schema example to include the `type` field as `mcq-single`:

```js
"type": "mcq-single",
```

This is a minimal change — the AI still generates MCQ single by default (matching KIIP format). Future admin tooling (Phase 4) will allow manually creating other question types.

**Step 2: Verify and commit**

```bash
git add server/routes/tests.js
git commit -m "feat: update AI generation prompt to use mcq-single type"
```

---

## Task 12: Update IMPLEMENTATION_PLAN.md + Final Verification

**Files:**
- Modify: `IMPLEMENTATION_PLAN.md`

**Step 1: Mark Phase 3 complete**

Update Phase 3 section heading to `## Phase 3 — Exam-Accurate Formats + Endless Mode ✅ COMPLETE` and check all task boxes.

**Step 2: Run full verification**

```bash
cd client && npm run build     # Must succeed
cd client && npm run lint      # Must pass
```

**Step 3: Commit and push**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 3 complete in implementation plan"
git push origin main
```
