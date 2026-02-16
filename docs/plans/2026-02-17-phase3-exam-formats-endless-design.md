# Phase 3 — Exam-Accurate Formats + Endless Mode: Design Doc

**Date:** 2026-02-17
**Status:** Approved
**Scope:** 5 question types, missed-only review, endless mode

---

## 1. Question Type Schema

### Type Enum

`mcq-single` | `mcq-multiple` | `short-answer` | `ordering` | `fill-in-the-blank`

### QuestionSchema Changes

```js
// Existing fields unchanged: text, image, options, explanation

type: {
  type: String,
  enum: ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'],
  default: 'mcq-single'
}

// New fields (optional, type-dependent):
acceptedAnswers: [String]       // short-answer: acceptable text answers (case-insensitive match)
correctOrder: [Number]          // ordering: correct sequence of option indices [0, 1, 2, 3]
blanks: [{                      // fill-in-the-blank: per-blank accepted answers
  acceptedAnswers: [String]
}]
```

**`options` usage by type:**
- `mcq-single` / `mcq-multiple`: options with `isCorrect` flags (unchanged)
- `ordering`: options are the items to reorder; `correctOrder` defines correct sequence
- `short-answer`: options array empty; `acceptedAnswers` on question
- `fill-in-the-blank`: options array empty; `blanks` array defines per-blank answers

### Migration

Existing questions have `type: 'multiple-choice'`. A migration script updates all to `mcq-single`. Code also treats `'multiple-choice'` as `'mcq-single'` for backward compatibility.

---

## 2. Scoring

| Type | Rule | Points |
|------|------|--------|
| `mcq-single` | Selected option has `isCorrect: true` | 1 |
| `mcq-multiple` | ALL selected options match ALL correct options (exact set match) | 1 |
| `short-answer` | Trimmed answer matches any `acceptedAnswers` (case-insensitive) | 1 |
| `ordering` | Submitted order matches `correctOrder` exactly | 1 |
| `fill-in-the-blank` | ALL blanks match their respective `acceptedAnswers` (case-insensitive) | 1 |

---

## 3. AnswerSchema Changes

```js
// Existing: questionIndex, isCorrect, isOverdue stay

// Replace selectedOption with:
selectedOptions: [Number]    // MCQ single (array of 1) + MCQ multiple
textAnswer: String           // short-answer
orderedItems: [Number]       // ordering: user's submitted order
blankAnswers: [String]       // fill-in-the-blank: user's answers per blank
```

Backward compatibility: old attempts with `selectedOption` (Number) still readable. Read logic checks for both `selectedOption` and `selectedOptions`.

Attempt `mode` enum expanded: `['Practice', 'Test', 'Endless']`

---

## 4. TestTaker UI — Per-Type Widgets

| Type | Widget | Keyboard |
|------|--------|----------|
| `mcq-single` | Current OptionButton grid (unchanged) | 1-4 select |
| `mcq-multiple` | Checkbox-style buttons, multi-select toggle | 1-4 toggle |
| `short-answer` | Text input below question | Type + Enter |
| `ordering` | Draggable list with up/down buttons | Up/down arrows |
| `fill-in-the-blank` | Question text split at `___` with inline inputs | Tab between blanks |

**Implementation:**
- A `QuestionRenderer` component switches on `question.type` and renders the appropriate widget
- Each widget calls `onAnswer(answerData)` with the type-appropriate payload
- Ordering uses native HTML drag API (no external library) + keyboard up/down fallback buttons
- Fill-in-the-blank splits `question.text` on `___` markers and renders `<input>` at each split point

---

## 5. Missed-Only Review

**Trigger:** "Review missed questions" button in the result card after submission.

**Behavior:**
- Filters question list to only incorrect/unanswered questions
- Read-only review mode: wrong answer highlighted red, correct answer highlighted green, explanation shown
- No timer, no scoring, no new attempt saved
- Navigation dots show only missed questions (renumbered)
- "Back to full results" button to exit review

**Implementation:** `reviewMode` state flag + `missedQuestions` filtered array. No new route or API call.

---

## 6. Endless Mode

### Entry Point

"Endless Mode" card on Home page. User selects filter (level, unit, or all/random) and starts.

### Flow

1. Client requests batch: `GET /api/tests/endless?level=&unit=&exclude=id1,id2,...&limit=10`
2. Server picks 10 random questions from matching tests, excluding recently-seen IDs
3. User answers one at a time (Practice-style instant feedback)
4. Every 10 questions: auto-submit chunk attempt via `POST /api/tests/endless/attempt`
5. Client fetches next batch, rolling `exclude` window of last 30 question IDs
6. Session continues until user exits

### New API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/tests/endless?level=&unit=&exclude=&limit=` | Random question batch |
| `POST` | `/api/tests/endless/attempt` | Save chunk attempt |

### New Route & Page

- Route: `/endless`
- Component: `EndlessMode.jsx` (separate from TestTaker)
- Uses same per-type question widgets via shared `QuestionRenderer`

### Attempt Tracking

Each chunk creates a regular Attempt with:
- `mode: 'Endless'`
- `testId`: null (endless isn't tied to a single test)
- Answers reference source question IDs for traceability
- Home dashboard recent attempts show endless chunks

---

## 7. Files Affected

### Backend
- `server/models/Test.js` — QuestionSchema changes (type enum, acceptedAnswers, correctOrder, blanks)
- `server/models/Attempt.js` — AnswerSchema changes (selectedOptions, textAnswer, orderedItems, blankAnswers), mode enum
- `server/routes/tests.js` — scoring logic update, new endless endpoints
- New: migration script for `type: 'multiple-choice'` → `'mcq-single'`

### Frontend
- New: `client/src/components/QuestionRenderer.jsx` — type-switching widget
- New: `client/src/components/question-types/MCQSingle.jsx`
- New: `client/src/components/question-types/MCQMultiple.jsx`
- New: `client/src/components/question-types/ShortAnswer.jsx`
- New: `client/src/components/question-types/Ordering.jsx`
- New: `client/src/components/question-types/FillInTheBlank.jsx`
- Modified: `client/src/pages/TestTaker.jsx` — use QuestionRenderer, add reviewMode, update scoring
- New: `client/src/pages/EndlessMode.jsx`
- Modified: `client/src/pages/Home.jsx` — endless mode entry card
- Modified: `client/src/App.jsx` — add `/endless` route
