# KIIP Study — Project Report

**Author:** Alex Reznitskii
**Date:** 2026-02-21
**Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase-by-Phase Summary](#2-phase-by-phase-summary)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Model](#4-data-model)
5. [API Reference](#5-api-reference)
6. [Design System](#6-design-system)
7. [Testing](#7-testing)
8. [Deployment](#8-deployment)
9. [Future Considerations](#9-future-considerations)

---

## 1. Executive Summary

KIIP Study is a desktop-first MERN-stack exam practice platform for learners preparing for the Korea Immigration and Integration Program (KIIP) written exam. It provides a public, admin-curated test library with per-user progress tracking, resumable sessions, and AI-assisted test generation.

### Key Facts

| Item | Detail |
|------|--------|
| Platform target | Desktop-first; keyboard-first |
| Frontend | React 19, Vite, styled-components 6, React Router DOM 7 |
| Backend | Node.js, Express 5, Mongoose 9, MongoDB 7 |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Auth | Google OAuth 2.0 + JWT in httpOnly cookies |
| Design aesthetic | Japandi Warm Minimalism |
| Deployment | Docker Compose (3 containers) + GitHub Actions CI/CD |
| Test suite | 35 Playwright E2E tests |
| Phases completed | 0 through 5 (all complete); Phase 6 (PDF exports) implemented |

### Product Principles

- All tests are public; progress is tracked per authenticated user.
- Test generation and editing are admin-only operations.
- No listening/speaking question types (out of scope for KIIP written exam prep).
- No spaced repetition, no gamification, no recommendations engine.
- Korean questions; explanations bilingual (English + optional Korean).

---

## 2. Phase-by-Phase Summary

### Phase 0 — Stabilization

**Goal:** Fix existing codebase deficiencies before building new features.

| Area | Work Done |
|------|-----------|
| API validation | `express-validator` on `/generate` (200–50,000 character range); file MIME allowlists; multer file size limits (10 MB) |
| Rate limiting | `express-rate-limit` at 10 requests/minute on AI generation endpoints |
| Error handling (frontend) | Loading, error-with-retry, and empty states on `Home.jsx`, `CreateTest.jsx`, `TestTaker.jsx`; axios timeouts (10s fetch, 30s upload, 120s generate) |
| UX fixes | Mode-switch confirmation modal; `beforeunload` navigation guard; correct overdue timer accounting; timer stop on submission |
| Static file serving | `/uploads`, `/uploads/images`, `/uploads/documents` created on startup and served via `express.static` |
| Health endpoint | `GET /health` returns MongoDB connection state and server uptime |
| Cleanup | Removed unused `openai` package; removed stale `tests/verify_app.js` |

### Phase 1 — Production Foundation

**Goal:** Deploy to a home server with Docker Compose, persistent data, and CI on every PR.

| Area | Work Done |
|------|-----------|
| Client Dockerfile | Multi-stage: `node:20-alpine` build stage, `nginx:alpine` serve stage |
| Nginx | Serves the SPA, proxies `/api`, `/uploads`, `/health` to the Express container |
| Docker Compose | Three services: `mongo` (MongoDB 7), `server` (Express), `client` (nginx); two named volumes: `mongo_data`, `server_uploads` |
| Health checks | All three services have Docker health checks with retry logic |
| CI pipeline | `.github/workflows/ci.yml` — install, lint, build, Playwright (Chromium) on every PR targeting `main` |
| Auto-deploy | `.github/workflows/deploy.yml` — SSH into home server, `git pull`, `docker compose build && up -d`, health check loop on every push to `main` |

### Phase 2 — Instant Library UX

**Goal:** Users can find any test in under three keystrokes via search and Ctrl+P.

| Area | Work Done |
|------|-----------|
| Home dashboard | "Continue last session" card (active sessions), "Recent attempts" row per authenticated user |
| Cursor pagination | `GET /api/tests` returns up to 50 results per page with a cursor-based `nextCursor` for "Load more" |
| Server-side search | `$text` index on `title`, `category`, `description`; `level` and `unit` filter parameters; aggregation pipeline joins last attempt per test |
| Command palette | `CommandPalette.jsx` — Ctrl+P trigger from any page, debounced live search, keyboard navigation (arrows + Enter), recent tests when query is empty |
| Shortcuts modal | `ShortcutsModal.jsx` — Ctrl+K trigger displays all keyboard shortcuts |
| Keyboard navigation | In TestTaker: keys 1–4 select MCQ options; arrow keys navigate between questions |

### Phase 3 — Exam-Accurate Formats + Endless Mode

**Goal:** Support all KIIP paper question types; provide an endless practice draw from the full library.

| Area | Work Done |
|------|-----------|
| Question types | Schema extended with `type` enum: `mcq-single`, `mcq-multiple`, `short-answer`, `ordering`, `fill-in-the-blank`; additional fields: `acceptedAnswers`, `correctOrder`, `blanks` |
| Answer schema | `AnswerSchema` updated: `selectedOptions`, `textAnswer`, `orderedItems`, `blankAnswers` |
| Shared scoring | `server/utils/scoring.js` — single `scoreQuestion()` function handles all 5 types, used by both server-side verification and client-side feedback |
| Per-type renderers | `QuestionRenderer.jsx` switcher dispatches to `MCQSingle`, `MCQMultiple`, `ShortAnswer`, `Ordering`, `FillInTheBlank` sub-components with keyboard support |
| Server-side verification | `POST /api/tests/:id/attempt` re-scores all answers using the shared scoring utility; client-submitted score is ignored |
| Missed-only review | After Test mode submission, users can filter the review screen to show only incorrect answers |
| Endless mode API | `GET /api/tests/endless` — Fisher-Yates shuffle with exclude-set; `POST /api/tests/endless/attempt` — chunk submission |
| Endless mode page | `EndlessMode.jsx` — filter screen, Practice-style instant feedback, rolling 30-question exclusion window, batch auto-fetch, stats bar, end screen |
| Home integration | Endless mode entry card on Home dashboard; recent attempts handle `Endless` mode label |

### Phase 4 — Admin Suite + Authentication

**Goal:** Gate all content mutation behind admin auth; provide full admin tooling.

| Area | Work Done |
|------|-----------|
| Auth dependencies | `passport`, `passport-google-oauth20`, `cookie-parser`, `jsonwebtoken` installed |
| User model | `User.js` — `email`, `googleId`, `displayName`, `isAdmin`, `createdAt` |
| Middleware | `server/middleware/auth.js` — `requireAuth` (JWT from httpOnly cookie), `requireAdmin` (isAdmin flag check) |
| Google OAuth | Passport Google Strategy configured; first-login creates user; admin granted by matching `ADMIN_EMAIL` env var |
| JWT flow | On OAuth callback, a 7-day JWT is signed and set as an httpOnly `SameSite=Lax` cookie |
| Frontend auth | `AuthContext.jsx` — `useAuth()` hook providing `user`, `loading`, `logout`; shared `api` axios instance with `withCredentials: true` |
| Nav auth UI | Sign in button (redirects to `/api/auth/google/start`); display name + sign out when authenticated; admin-gated nav links |
| Route restructuring | Generation, import, editing, and deletion moved from `/api/tests/` to `/api/admin/tests/` with `requireAuth + requireAdmin` guard applied to the entire admin router |
| Flag model | `Flag.js` — `userId`, `testId`, `questionIndex?`, `reason` (enum), `note`, `status`, `resolution`; compound unique index prevents duplicate flags per user+test+question |
| Flag submission UI | Modal in `TestTaker.jsx` with reason dropdown and optional free-text note |
| Admin flags page | `AdminFlags.jsx` — paginated queue, populated user/test names, resolve/dismiss workflow |
| Admin test editor | `AdminTestEditor.jsx` — full editor for all 5 question types with add/remove/reorder questions and options |
| Flag count badge | Navigation polls `GET /api/admin/flags/count` and shows a warning-colored badge on the Flags nav link |
| Attempt ownership | `userId` added to `AttemptSchema`; `POST /api/tests/:id/attempt` requires auth and writes `req.user._id` |

### Phase 5 — Continuity + Audit

**Goal:** Sessions resume across devices with timer intact; admin actions are audited.

| Area | Work Done |
|------|-----------|
| AuditLog model | `AuditLog.js` — `userId`, `action` (enum), `targetType`, `targetId`, `details`; indexed by `createdAt`, `userId`, and `(targetType, targetId)` |
| Audit writes | All admin mutations (generate, import, edit, delete, flag resolve/dismiss) write to `AuditLog` via fire-and-forget `.catch(() => {})` to avoid blocking the response |
| Admin audit viewer | `GET /api/admin/audit` — cursor-paginated, populated with admin user info |
| TestSession model | `TestSession.js` — `userId`, `testId`, `mode`, `answers`, `currentQuestion`, `remainingTime`, `status` (`active`/`completed`/`abandoned`), `startedAt`, `lastSavedAt` |
| Session start | `POST /api/sessions/start` — returns existing active session (with `resumed: true`) or creates a new one; prevents duplicate active sessions per user per test |
| Session save | `PATCH /api/sessions/:id` — persists answers, current question index, and remaining time; updates `lastSavedAt` |
| Session submit | `POST /api/sessions/:id/submit` — scores all answers server-side using the shared scoring utility, creates an `Attempt`, marks session as `completed` atomically |
| Session abandon | `DELETE /api/sessions/:id` — sets status to `abandoned` (soft delete) |
| Active sessions | `GET /api/sessions/active` — up to 5 active sessions for the authenticated user, sorted by `lastSavedAt` |
| Home integration | Active sessions displayed as "Continue" cards on the Home dashboard |

### Phase 6 — PDF Exports

**Goal:** All four PDF export variants render cleanly with Japandi design tokens.

| Area | Work Done |
|------|-----------|
| PDF generator | `server/utils/pdfGenerator.js` — pdfkit-based; design tokens (colors, spacing, border) mirror `client/src/theme/tokens.js` |
| Test variants | `blank` — questions only, no answers; `answerKey` — correct answers highlighted with explanations |
| Attempt variants | `student` — user answers marked correct/incorrect; `report` — full summary with score, timing, overdue data, and explanations |
| All question types | All 5 types rendered correctly in PDF output |
| Routes | `GET /api/pdf/test/:id?variant=blank|answerKey`, `GET /api/pdf/attempt/:attemptId?variant=student|report` |
| Ownership check | Attempt PDF endpoints verify `attempt.userId === req.user._id`; admins bypass this check |
| Auth | All PDF routes require `requireAuth` |

---

## 3. Architecture Overview

```
Client (React 19 + Vite, port 5173 dev / nginx prod)
├── pages/
│   ├── Home.jsx                 Dashboard: test library, active sessions, recent attempts
│   ├── CreateTest.jsx           Admin: paste text or upload doc to generate test
│   ├── TestTaker.jsx            Test and Practice modes with timer; flag submission
│   ├── EndlessMode.jsx          Endless mode: batch fetch, instant feedback, chunk submit
│   ├── AdminTestEditor.jsx      Admin: edit all fields and all 5 question types
│   └── AdminFlags.jsx           Admin: flags moderation queue
├── components/
│   ├── CommandPalette.jsx       Ctrl+P overlay with debounced test search
│   ├── ShortcutsModal.jsx       Ctrl+K overlay listing all keyboard shortcuts
│   ├── QuestionRenderer.jsx     Per-type question renderer switcher
│   └── FilterDropdown.jsx       Level/unit filter controls
├── context/
│   └── AuthContext.jsx          useAuth() hook; shared axios instance
├── utils/
│   └── api.js                   Configured axios instance (withCredentials, base URL)
└── theme/
    ├── tokens.js                Design tokens (colors, typography, spacing, motion)
    └── GlobalStyles.js          Global CSS reset and base styles

Server (Express 5, port 5000)
├── routes/
│   ├── tests.js                 Public: list, get, attempt, endless
│   ├── auth.js                  OAuth: Google strategy, /me, /logout
│   ├── admin.js                 Admin-guarded: generate, import, edit, delete, flags, audit
│   ├── sessions.js              Auth-required: start, save, submit, active, abandon
│   ├── flags.js                 Auth-required: submit flag
│   └── pdf.js                   Auth-required: test and attempt PDF export
├── models/
│   ├── Test.js                  Test + Question + Option schemas
│   ├── Attempt.js               Attempt + Answer schemas
│   ├── User.js                  Google OAuth user
│   ├── Flag.js                  User-submitted issue reports
│   ├── TestSession.js           Resumable in-progress session
│   └── AuditLog.js              Append-only admin action log
├── middleware/
│   └── auth.js                  requireAuth, requireAdmin
└── utils/
    ├── llm.js                   Gemini 2.5 Flash prompt + JSON parsing
    ├── scoring.js               scoreQuestion() — all 5 question types
    ├── pdfGenerator.js          pdfkit template with Japandi tokens
    └── autoImporter.js          Startup: imports .md/.txt from additionalContext/tests/
```

### Request Flow

1. The browser hits nginx on port 80 in production. Static assets are served directly. Requests to `/api/*`, `/uploads/*`, and `/health` are reverse-proxied to Express on port 5000.
2. Express middleware chain: CORS, JSON body parser, cookie parser, Passport initialisation, then route handlers.
3. Auth-required routes extract the JWT from the `jwt` httpOnly cookie, verify with `jsonwebtoken`, and hydrate `req.user` from MongoDB.
4. Admin routes apply both `requireAuth` and `requireAdmin` before any handler runs.
5. AI generation calls the Gemini 2.5 Flash API and returns a structured JSON test that is immediately persisted to MongoDB.

---

## 4. Data Model

### Collections

#### Test

Stores the question library. All tests are publicly readable.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `title` | String | Required |
| `category` | String | Default `'General'` |
| `description` | String | Optional |
| `level` | String | KIIP level (e.g. `'2'`) |
| `unit` | String | KIIP unit number |
| `questions` | `QuestionSchema[]` | Embedded array |
| `createdAt` | Date | Auto set |

**Indexes:** `$text` on `(title, category, description)` for full-text search; compound `(level, unit, createdAt)` for filter + sort.

**QuestionSchema fields:** `text`, `image?`, `options: [{text, isCorrect}]`, `explanation?`, `type` (enum: `mcq-single`, `mcq-multiple`, `short-answer`, `ordering`, `fill-in-the-blank`), `acceptedAnswers[]`, `correctOrder[]`, `blanks: [{acceptedAnswers[]}]`.

#### Attempt

Stores completed test attempts (one per submission).

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `testId` | ObjectId ref Test | Optional (null for Endless) |
| `userId` | ObjectId ref User | Set from authenticated request |
| `score` | Number | Server-verified correct count |
| `totalQuestions` | Number | |
| `duration` | Number | Seconds spent |
| `overdueTime` | Number | Seconds spent after timer expiry |
| `answers` | `AnswerSchema[]` | Per-question answer + isCorrect |
| `mode` | String enum | `'Practice'`, `'Test'`, `'Endless'` |
| `sourceQuestions` | `[{testId, questionIndex}]` | Populated for Endless mode |
| `createdAt` | Date | Auto set |

**AnswerSchema fields:** `questionIndex`, `selectedOptions[]`, `textAnswer`, `orderedItems[]`, `blankAnswers[]`, `isCorrect`, `isOverdue`.

#### User

Created on first Google OAuth login.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `email` | String | Unique, required |
| `googleId` | String | Unique, required |
| `displayName` | String | From Google profile |
| `isAdmin` | Boolean | Default false; set by `ADMIN_EMAIL` match on first login |
| `createdAt` | Date | Auto set |

#### Flag

User-submitted issue reports, private to admins.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `userId` | ObjectId ref User | Required |
| `testId` | ObjectId ref Test | Required |
| `questionIndex` | Number | Optional (null = entire test) |
| `reason` | String enum | `'incorrect-answer'`, `'unclear-question'`, `'typo'`, `'other'` |
| `note` | String | Max 500 chars |
| `status` | String enum | `'open'` (default), `'resolved'`, `'dismissed'` |
| `resolution` | String | Admin-written resolution note |
| `createdAt`, `updatedAt` | Date | Via `{ timestamps: true }` |

**Indexes:** Unique compound `(userId, testId, questionIndex)` prevents duplicate flags; `(status, createdAt)` for queue sorting.

#### TestSession

Persists in-progress test state server-side to enable cross-device resumption.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `userId` | ObjectId ref User | Required |
| `testId` | ObjectId ref Test | Required |
| `mode` | String enum | `'Test'`, `'Practice'` |
| `answers` | `SessionAnswerSchema[]` | In-progress answers (no isCorrect) |
| `currentQuestion` | Number | Last-viewed question index |
| `remainingTime` | Number | Seconds remaining on the timer |
| `status` | String enum | `'active'`, `'completed'`, `'abandoned'` |
| `startedAt` | Date | |
| `lastSavedAt` | Date | Updated on every PATCH |

**Indexes:** `(userId, testId, status)` for duplicate-session check; `(userId, status, lastSavedAt)` for dashboard listing.

#### AuditLog

Append-only log of all admin mutations.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `userId` | ObjectId ref User | Admin who performed the action |
| `action` | String enum | `test.create`, `test.import`, `test.generate`, `test.generate-from-file`, `test.edit`, `test.delete`, `flag.resolve`, `flag.dismiss` |
| `targetType` | String enum | `'Test'`, `'Flag'` |
| `targetId` | ObjectId | ID of the affected document |
| `details` | Mixed | Context-specific (e.g. `{ title: '...' }`) |
| `createdAt` | Date | Auto set |

**Indexes:** `createdAt` descending for timeline view; `(userId, createdAt)` for per-admin queries; `(targetType, targetId)` for per-document history.

---

## 5. API Reference

### Public — Tests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tests` | List tests. Query: `q`, `level`, `unit`, `cursor`, `limit` (max 50). Returns `{ tests, nextCursor, total }` with last attempt joined per test. |
| `GET` | `/api/tests/:id` | Fetch full test including questions. |
| `GET` | `/api/tests/endless` | Random question batch. Query: `level`, `unit`, `exclude` (comma-separated `testId:qIdx`), `limit`. Requires auth. |
| `POST` | `/api/tests/endless/attempt` | Save endless mode chunk attempt. Requires auth. |
| `POST` | `/api/tests/:id/attempt` | Submit attempt; server re-scores all answers. Requires auth. |
| `GET` | `/api/tests/recent-attempts` | Recent attempts for the authenticated user with test metadata. Requires auth. |
| `GET` | `/health` | MongoDB state + server uptime. Public. |

### Auth — Google OAuth + Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/google/start` | Initiate Google OAuth flow (redirects to Google). |
| `GET` | `/api/auth/google/callback` | OAuth callback; sets JWT httpOnly cookie; redirects to client. |
| `GET` | `/api/auth/me` | Returns current user `{ _id, email, displayName, isAdmin }`. Requires auth. |
| `POST` | `/api/auth/logout` | Clears the `jwt` cookie. |

### Sessions — Resumable Test Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions/start` | Start or resume a session. Body: `{ testId, mode }`. Returns `{ session, resumed }`. Requires auth. |
| `PATCH` | `/api/sessions/:id` | Save progress. Body: `{ answers, currentQuestion, remainingTime }`. Requires auth. |
| `POST` | `/api/sessions/:id/submit` | Score, create Attempt, mark session completed. Returns `{ attempt, score, total, percentage }`. Requires auth. |
| `GET` | `/api/sessions/active` | List active sessions (up to 5) for the current user. Requires auth. |
| `DELETE` | `/api/sessions/:id` | Abandon session (soft delete, status → `abandoned`). Requires auth. |

### Flags — User Issue Reporting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags` | Submit or update a flag. Body: `{ testId, questionIndex?, reason, note? }`. Upserts by `(userId, testId, questionIndex)`. Requires auth. |

### Admin — Content Management (requireAuth + requireAdmin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/tests/generate` | Generate test from pasted text via Gemini 2.5 Flash. Rate-limited (10/min). |
| `POST` | `/api/admin/tests/generate-from-file` | Upload PDF/DOCX/TXT/MD; extract text; generate test. Temp file deleted after extraction. Rate-limited. |
| `POST` | `/api/admin/tests/upload` | Upload single image. Returns `imageUrl`. |
| `POST` | `/api/admin/tests/upload-multiple` | Upload up to 20 images. |
| `POST` | `/api/admin/tests/import` | Import test from JSON body. |
| `PATCH` | `/api/admin/tests/:id` | Edit test metadata and/or questions. |
| `DELETE` | `/api/admin/tests/:id` | Delete test and all its attempts. |
| `GET` | `/api/admin/flags` | Paginated flag queue. Query: `status`, `cursor`, `limit`. Populated with user/test info. |
| `GET` | `/api/admin/flags/count` | Count of open flags (for nav badge). |
| `PATCH` | `/api/admin/flags/:id` | Resolve or dismiss a flag. Body: `{ status, resolution }`. |
| `GET` | `/api/admin/audit` | Cursor-paginated audit log. |

### PDF — Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pdf/test/:id?variant=blank\|answerKey` | Export test as PDF. `blank` — questions only; `answerKey` — correct answers + explanations. Requires auth. |
| `GET` | `/api/pdf/attempt/:attemptId?variant=student\|report` | Export attempt as PDF. `student` — user answers; `report` — full summary with timing and explanations. Users can only export their own attempts. Requires auth. |

---

## 6. Design System

The KIIP Study design system is named Japandi Warm Minimalism, inspired by the intersection of Japanese wabi-sabi and Scandinavian minimalism. All tokens are defined in `client/src/theme/tokens.js` and consumed via styled-components' `ThemeProvider`.

### Color Palette

| Role | Token | Value |
|------|-------|-------|
| Canvas (page background) | `colors.bg.canvas` | `#F7F2E8` |
| Surface (cards, modals) | `colors.bg.surface` | `#FFFFFF` |
| Surface alt | `colors.bg.surfaceAlt` | `#FAF7F1` |
| Border subtle | `colors.border.subtle` | `#E6DDCF` |
| Text primary | `colors.text.primary` | `#1F2328` |
| Text muted | `colors.text.muted` | `#5B5F64` |
| Text faint | `colors.text.faint` | `#7B8086` |
| Accent clay (primary CTA) | `colors.accent.clay` | `#A0634A` |
| Accent moss | `colors.accent.moss` | `#657655` |
| Accent indigo (focus, links) | `colors.accent.indigo` | `#2A536D` |
| Success | `colors.state.success` | `#2F6B4F` |
| Warning | `colors.state.warning` | `#B07A2A` |
| Danger | `colors.state.danger` | `#B43A3A` |

### Typography

| Scale | Size | Line Height | Weight |
|-------|------|-------------|--------|
| `h1` | 32px | 40px | 650 |
| `h2` | 24px | 32px | 650 |
| `h3` | 18px | 26px | 650 |
| `body` | 16px | 26px | 500 |
| `small` | 14px | 22px | 450 |
| `micro` | 12px | 18px | 450 |

Font stack: `Inter, 'BIZ UDPGothic', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

BIZ UDPGothic provides Unicode coverage for Korean glyphs when Inter lacks them.

### Spacing and Layout

| Token | Value |
|-------|-------|
| Max content width | 1040px |
| Grid unit | 8px |
| Space scale | 0, 4, 8, 12, 16, 24, 32, 40, 48, 64px |
| Border radius `sm` | 10px |
| Border radius `md` | 14px |
| Border radius `lg` | 18px |
| Border radius `pill` | 999px |
| Button height | 44px |
| Input height | 48px |
| Shadow `sm` | `0 1px 2px rgba(20,20,20,0.06)` |
| Shadow `md` | `0 6px 18px rgba(20,20,20,0.10)` |

### Motion

| Token | Value |
|-------|-------|
| Fast transition | 120ms ease-out |
| Base transition | 160ms ease-out |

All transitions respect `prefers-reduced-motion`.

### Design Rules

- No neon colors. No pure `#FFFFFF` page background. No aggressive red for danger states.
- No harsh box-shadows (soft shadows only).
- Microcopy is warm and non-judgmental (e.g. "Leave this test?" not "Warning: unsaved data will be lost").
- All text must pass WCAG AA contrast ratios.
- Focus rings use indigo `#2A536D`.
- Minimum touch target size: 44px (matches button control height token).

### Component Conventions

All styling is done via styled-components. No inline styles, no CSS modules, no utility classes.

```jsx
// Correct: theme token via props
const Button = styled.button`
  background: ${({ theme }) => theme.colors.accent.clay};
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
`;

// Incorrect: hardcoded value
const Button = styled.button`
  background: #A0634A;
`;
```

Global styles (font-face imports, body background, box-sizing reset) live in `client/src/theme/GlobalStyles.js`.

---

## 7. Testing

### Playwright E2E Suite

The test suite lives in `tests/app.spec.js` and runs against a full local stack (Vite dev server + Express + MongoDB).

| Suite | Tests | Coverage |
|-------|-------|---------|
| Home Page | 5 | Header, nav links, logo, active state |
| Create Test Page | 7 | Navigation, microcopy, validation (min 200 chars), character counter, button enable/disable |
| Test Taking Flow | 8 | Test card states, navigation to test, mode selector, timer display, Exit button, question nav dots, dot jumping, Prev/Next, answer selection |
| Practice Mode | 3 | Mode-switch confirmation modal, instant feedback + explanation in Practice, no feedback in Test mode |
| Exit and Navigation | 3 | Exit confirmation modal, Stay dismisses modal, Leave returns to home |
| Delete Test Flow | 4 | Delete button presence, confirmation modal microcopy, Keep it dismisses, |
| Error Handling | 3 | API failure shows error state, retry button, invalid test ID |
| Accessibility | 3 | Buttons have accessible names, nav links have names, form inputs have labels |

**Total: 35 tests**

Tests run on Chromium only. The CI pipeline installs Playwright browsers and runs all 35 tests on every PR. Results are uploaded as a GitHub Actions artifact (`playwright-report/`) with a 7-day retention window.

### Running Tests

```bash
# Run full suite
npx playwright test

# Run specific suite
npx playwright test --grep "Home Page"

# Run with headed browser (for debugging)
npx playwright test --headed

# Run on specific project
npx playwright test --project=chromium
```

Environment variables used by tests:

| Variable | Default |
|----------|---------|
| `BASE_URL` | `http://localhost:5173` |
| `API_URL` | `http://localhost:5000` |

---

## 8. Deployment

### Docker Compose Architecture

The production deployment runs three containers on a single host, communicating over a private bridge network (`kiip-network`).

```
Internet
    |
    | :80
    v
[client: nginx]  ──── serves SPA ──── browser
    |
    | /api/*, /uploads/*, /health (reverse proxy)
    v
[server: Express :5000]
    |
    | mongodb://mongo:27017
    v
[mongo: MongoDB 7]
```

**Named volumes:**

| Volume | Mounted at | Purpose |
|--------|-----------|---------|
| `mongo_data` | `/data/db` in `mongo` | Persists database across restarts and rebuilds |
| `server_uploads` | `/app/uploads` in `server` | Persists uploaded images across restarts |

The `additionalContext/tests/` directory is bind-mounted read-only into the server container so the auto-importer can seed the library on startup.

### Container Health Checks

| Container | Check | Interval |
|-----------|-------|---------|
| `mongo` | `mongosh --eval "db.adminCommand('ping')"` | 10s, 5 retries |
| `server` | `wget -q --spider http://localhost:5000/health` | 30s, 3 retries |
| `client` | `wget -q --spider http://localhost:80` | 30s, 3 retries |

The `server` container waits for `mongo` to be healthy before starting. The `client` container waits for `server` to be healthy before starting.

### Environment Variables

| Variable | Container | Required | Notes |
|----------|-----------|----------|-------|
| `GEMINI_API_KEY` | server | Yes | Google Gemini API key |
| `GOOGLE_CLIENT_ID` | server | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | server | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | server | No | Defaults to `/api/auth/google/callback` |
| `ADMIN_EMAIL` | server | Yes | Google account email that receives `isAdmin: true` on first login |
| `JWT_SECRET` | server | Yes | Secret for signing JWTs (use a long random string in production) |
| `CLIENT_URL` | server | No | CORS origin; defaults to `http://localhost:5173` |
| `PORT` | server | No | Defaults to `5000` |
| `MONGO_URI` | server | No | Defaults to `mongodb://localhost:27017/kiip_test_app` |
| `VITE_API_URL` | client build | No | Defaults to `http://localhost:5000` |

### CI/CD Pipeline

#### CI (`.github/workflows/ci.yml`) — runs on every PR to `main`

1. Checkout repository.
2. Set up Node 20 with npm cache.
3. Install root, client, and server dependencies (`npm ci`).
4. Lint client (`cd client && npm run lint`).
5. Build client (`cd client && npm run build`).
6. Install Playwright Chromium browser.
7. Start MongoDB 7 via `supercharge/mongodb-github-action`.
8. Start Express server in background.
9. Start Vite dev server in background.
10. Wait for both servers to be ready (`wait-on`).
11. Run Playwright tests on Chromium.
12. Upload `playwright-report/` as artifact (7-day retention).

#### Auto-Deploy (`.github/workflows/deploy.yml`) — runs on every push to `main`

1. SSH into the home server using `appleboy/ssh-action`.
2. `git pull origin main`
3. `docker compose build`
4. `docker compose up -d`
5. Poll `http://localhost:80/health` every 5 seconds for up to 150 seconds.
6. Fail the workflow if health check does not pass.

### Starting the Stack

```bash
# Production (Docker Compose)
docker compose up -d

# Development (local, requires MongoDB running)
npm run install-all
npm start               # starts client (port 5173) + server (port 5000) concurrently

# Client only
npm run client

# Server only
npm run server

# Client production build
cd client && npm run build
```

---

## 9. Future Considerations

The following improvements could be made in future development cycles. None of these were in scope for the current implementation.

### Analytics Dashboard

Admin-facing progress charts and test difficulty statistics. Aggregate attempt data by test, time period, and score distribution. Useful for identifying questions that are consistently answered incorrectly (high difficulty) or trivially correct (low utility).

### Multi-Language UI

The application currently shows Korean question text and English explanations. The UI chrome (buttons, headings, labels) is in English. Adding Korean and Russian translations for the UI would broaden accessibility for the KIIP learner demographic.

### Mobile Responsive Polish

The app is desktop-first with a 1040px max width. While it renders on mobile, the TestTaker keyboard navigation and question dot rail do not adapt well to small screens. A dedicated mobile layout pass would improve usability on phones.

### Test Sharing via Public Links

Allow admins to generate a shareable URL for a specific test that bypasses authentication and presents the test in a read-only or anonymous-attempt mode. Useful for distributing practice materials outside the platform.

### Bulk Import

A batch import endpoint and admin UI that accepts a ZIP archive or JSON array of tests. Currently tests must be imported one at a time.

### Question Bank Deduplication

The auto-importer and AI generator can create semantically duplicate questions across tests. A deduplication pass (either fuzzy string matching or embedding-based similarity) could flag or merge near-duplicate questions.

### Question Difficulty Metadata

Track per-question correct-attempt rates from historical attempt data and expose a `difficulty` field on `QuestionSchema`. Surface difficulty in the admin editor and optionally in the test UI.

### Listening and Speaking Question Types

KIIP Level 1 and intermediate levels include listening comprehension. If the platform were extended to those levels, audio playback and potentially speaking evaluation would be required. These are explicitly excluded for the current KIIP Level 2 written exam focus.
