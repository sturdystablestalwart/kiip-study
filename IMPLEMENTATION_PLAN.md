# KIIP Study — Implementation Plan

## Executive Summary

This document outlines the full implementation roadmap for KIIP Study, a MERN-stack KIIP exam practice platform with a public, admin-curated test library and per-user progress. The plan is organized into Phase 0 (stabilization of the current codebase) followed by six feature phases ordered by priority: production polish, instant library access, exam-accurate formats, admin-quality content control, authentication, and PDF exports.

**Owner:** Alex Reznitskii | **Version:** 2.0 | **Date:** 2026-02-15

**Source document:** `additionalContext/KIIP_Study_Requirements_Roadmap_Checklist.docx`

---

## Phase 0 — Stabilization (Current Codebase Fixes) ✅ COMPLETE

> All stabilization items have been verified and completed.

### 0.1 API Endpoints ✅

| Endpoint | Status | Details |
|----------|--------|---------|
| `POST /api/tests/generate` | ✅ Done | express-validator, rate limited (10/min), 200–50k char validation |
| `POST /api/tests/upload` | ✅ Done | multer with MIME filter, 10MB limit, returns imageUrl |
| `POST /api/tests/upload-multiple` | ✅ Done | Up to 20 images per request |
| `POST /api/tests/generate-from-file` | ✅ Done | PDF/DOCX/TXT/MD, rate limited, temp file cleanup |
| `GET /health` | ✅ Done | Added — returns mongo state + uptime |

### 0.2 Image Handling ✅

- [x] `uploads/` directory served statically (`server/index.js:17`)
- [x] Image upload endpoint returns correct URLs with metadata
- [x] Images referenced via `/uploads/images/` path

### 0.3 Input Validation ✅

- [x] express-validator on `/generate` (200–50k chars)
- [x] Multer file size limits (10MB documents, 10MB images)
- [x] Empty text prevented (min 200 chars)
- [x] Rate limiting on `/generate` and `/generate-from-file` (10 req/min)

### 0.4 Error Handling (Frontend) ✅

- [x] Home.jsx: loading, error (with retry), and empty states
- [x] CreateTest.jsx: validation errors, upload errors, generation errors, character counter
- [x] TestTaker.jsx: error state for failed fetch, 10s timeout
- [x] All API calls use axios timeouts (10s fetch, 30s upload, 120s generate)

### 0.5 UX Fixes ✅

- [x] Mode toggle shows confirmation modal when user has progress
- [x] `beforeunload` warning prevents accidental navigation
- [x] Timer stops after submission (`isSubmitted` check in effect)
- [x] Overdue seconds tracked correctly

### 0.6 Static File Serving ✅

- [x] `uploads/`, `uploads/images/`, `uploads/documents/` created on startup
- [x] `express.static` middleware for `/uploads` route

### 0.7 Cleanup ✅

- [x] Removed unused `openai` package from server dependencies
- [x] Removed stale `tests/verify_app.js` (superseded by `tests/app.spec.js`)
- [x] Kept `bcryptjs` and `jsonwebtoken` for Phase 5 auth

---

## Phase 1 — Production Foundation ✅ COMPLETE

> Docker, CI, deploy to home server.

**Goal:** A deployed production instance on the home server with Docker Compose, persistent data across restarts, and CI that runs on every PR.

### Tasks (PR-sized)

- [x] **1.1** Multi-stage client Dockerfile (node:20-alpine build → nginx:alpine serve)
- [x] **1.2** Nginx reverse proxy: serves SPA, proxies `/api` + `/uploads` + `/health` to Express
- [x] **1.3** Docker volumes: `mongo_data` + `server_uploads` named volumes, persistent across rebuilds
- [x] **1.4** `/health` endpoint with MongoDB state + uptime (done in Phase 0)
- [x] **1.5** CI: install → lint → build → Playwright chromium on every PR (`.github/workflows/ci.yml`)
- [x] **1.6** CI: SSH deploy on main push — pull → build → up → health check (`.github/workflows/deploy.yml`)

### Acceptance Criteria

- [x] Production instance runs on home server via Docker Compose
- [x] Data persists across container restarts (named volumes)
- [x] CI blocks PRs with lint/build/test failures
- [x] Deploy triggers automatically on main branch push

---

## Phase 2 — Instant Library UX ✅ COMPLETE

> Dashboard, search, Ctrl+P palette, Ctrl+K shortcuts, keyboard navigation.

**Goal:** Users can find any test quickly using search and Ctrl+P; keyboard shortcut list appears via Ctrl+K.

### Tasks (PR-sized)

- [x] **2.1** Home dashboard: "Continue last session" card + "Recent attempts" row
- [x] **2.2** Cursor pagination with "Load more" button (limit 20, max 50)
- [x] **2.3** Server-side search via `$text` index + level/unit filters + aggregation pipeline
- [x] **2.4** Ctrl+P command palette with debounced search and keyboard navigation (navbar trigger)
- [x] **2.5** Ctrl+K global shortcuts modal + keyboard navigation in TestTaker (1-4, arrows)

### API Changes

| Method | Endpoint | Change |
|--------|----------|--------|
| `GET` | `/api/tests?q=&level=&unit=&cursor=&limit=` | Aggregation pipeline, cursor pagination, text search |
| `GET` | `/api/tests/recent-attempts?limit=` | New — returns recent attempts with test metadata |

### Acceptance Criteria

- [x] Home page loads dashboard with continue/recent sections
- [x] Search returns results via Ctrl+P palette from any page
- [x] Level/Unit filter dropdowns narrow the test list
- [x] Ctrl+K shows shortcut reference
- [x] Keyboard-only navigation works (1-4 select, arrows navigate)

---

## Phase 3 — Exam-Accurate Formats + Endless Mode ✅ COMPLETE

> 5 question types, missed-only review, endless mode with batch fetching and chunk submissions.

**Goal:** Support all KIIP paper question types and offer an endless practice mode drawing from the full library.

### Tasks (PR-sized)

- [x] **3.1** Question type enum (`mcq-single`, `mcq-multiple`, `short-answer`, `ordering`, `fill-in-the-blank`) + schema fields (`acceptedAnswers`, `correctOrder`, `blanks`) + migration script
- [x] **3.2** AnswerSchema updated (`selectedOptions`, `textAnswer`, `orderedItems`, `blankAnswers`) + Endless mode support (`testId` optional, `sourceQuestions`, `mode: 'Endless'`)
- [x] **3.3** Shared scoring utility (server + client) for all 5 question types
- [x] **3.4** Per-type question renderer components (MCQSingle, MCQMultiple, ShortAnswer, Ordering, FillInTheBlank) + QuestionRenderer switcher
- [x] **3.5** TestTaker integrated with QuestionRenderer + keyboard shortcuts for MCQ types + missed-only review mode
- [x] **3.6** Server-side score verification in POST /:id/attempt using scoring utility
- [x] **3.7** Endless mode API: GET /endless (random batch with exclusion) + POST /endless/attempt (chunk submission)
- [x] **3.8** EndlessMode page: start screen with filters, Practice-style instant feedback, batch fetching, chunk auto-submission, stats bar, end screen
- [x] **3.9** Endless Mode entry card on Home dashboard + recent attempts display handles Endless mode

### API Changes

| Method | Endpoint | Change |
|--------|----------|--------|
| `GET` | `/api/tests/endless?level=&unit=&exclude=&limit=` | New — random question batch with exclusion |
| `POST` | `/api/tests/endless/attempt` | New — save endless chunk attempt |
| `POST` | `/api/tests/:id/attempt` | Updated — server-side score verification |

### Data Model Changes

**QuestionSchema additions:** `type` enum, `acceptedAnswers`, `correctOrder`, `blanks`
**AnswerSchema:** `selectedOptions`, `textAnswer`, `orderedItems`, `blankAnswers` (replaces `selectedOption`)
**AttemptSchema:** `mode` enum includes `'Endless'`, `testId` optional, `sourceQuestions` added

### Acceptance Criteria

- [x] All 5 question types render correctly with proper scoring
- [x] Endless mode draws non-repeating questions from the full library (rolling 30-question exclusion window)
- [x] Missed-only review shows only incorrect answers for re-practice

---

## Phase 4 — Admin Suite & Authentication ✅ COMPLETE

> Auth pulled from Phase 5 into Phase 4. Google OAuth, admin guards, test editor, flags.

**Goal:** Add authentication, admin role guards, admin test editor, and user flag system.

### Tasks (PR-sized)

- [x] **4.1** Install auth dependencies (passport, jwt, cookie-parser)
- [x] **4.2** User model with Google OAuth fields
- [x] **4.3** requireAuth + requireAdmin middleware
- [x] **4.4** Google OAuth strategy + auth routes (/me, /logout, /google/start, /google/callback)
- [x] **4.5** Frontend AuthContext + shared axios instance with credentials
- [x] **4.6** Nav auth UI (sign in/out, admin-gated links)
- [x] **4.7** Move generate/upload/delete routes to /api/admin/ with auth guards
- [x] **4.8** Update all frontend API calls to shared axios instance + admin URLs
- [x] **4.9** Gate admin features in UI (CreateButton, DeleteButton, EditButton)
- [x] **4.10** Add userId to Attempt model + requireAuth on user routes
- [x] **4.11** Flag model + flag API routes (user submit + admin queue)
- [x] **4.12** Flag submission UI in TestTaker (modal with reason + note)
- [x] **4.13** Admin flags moderation page (/admin/flags)
- [x] **4.14** Admin test editor page (/admin/tests/:id/edit) — all 5 question types
- [x] **4.15** Flag count badge in admin nav

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/google/start` | Initiate OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback |
| `POST` | `/api/auth/logout` | Clear session |
| `POST` | `/api/admin/tests/import` | Import test from JSON |
| `POST` | `/api/admin/tests/generate` | AI generation (admin-only) |
| `POST` | `/api/admin/tests/generate-from-file` | File-based generation (admin-only) |
| `PATCH` | `/api/admin/tests/:id` | Edit test |
| `DELETE` | `/api/admin/tests/:id` | Delete test |
| `POST` | `/api/flags` | User submits flag |
| `GET` | `/api/admin/flags` | Admin views flag queue |
| `GET` | `/api/admin/flags/count` | Open flags count (badge) |
| `PATCH` | `/api/admin/flags/:id` | Resolve/dismiss flag |

### Acceptance Criteria

- [x] Google OAuth login works; JWT stored in httpOnly cookie
- [x] Only admins can access generation/import/editing/delete routes
- [x] Admin test editor supports all 5 question types with validation
- [x] Flag queue displays all open flags with resolve/dismiss workflow
- [x] Nav shows sign in/out, admin links gated by isAdmin
- [x] User attempts tracked with userId, filtered per-user

---

## Phase 5 — Continuity + Audit ✅ COMPLETE

> Resumable sessions, audit logs. (Auth moved to Phase 4.)

**Goal:** Sessions are resumable across devices without timer reset; admin actions are audited.

### Tasks (PR-sized)

- [x] **5.1** AuditLog collection + middleware to record admin actions (create/edit/delete/generate/resolve)
- [x] **5.2** TestSession model: persist remaining time server-side; refresh restores timer
- [x] **5.3** Prevent duplicate active sessions per user per test
- [x] **5.4** Submit creates Attempt and closes session atomically

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/sessions/start` | Start test/endless session |
| `PATCH` | `/api/sessions/:id` | Save progress |
| `POST` | `/api/sessions/:id/submit` | Submit → create Attempt |
| `GET` | `/api/sessions/active` | Get active session for current user |
| `DELETE` | `/api/sessions/:id` | Abandon session |
| `GET` | `/api/attempts?cursor=&limit=` | Dashboard attempt feed |
| `GET` | `/api/admin/audit` | Admin audit log |

### Data Model Additions

- **TestSession** — resumable in-progress state per user (per test or endless)
- **AuditLog** — append-only admin and sensitive event log

### Acceptance Criteria

- [x] Session persists across devices; timer state survives refresh
- [x] Audit log records all admin mutations

---

## Phase 6 — PDF Exports ✅ COMPLETE

> Export blank/answer key/student answers/attempt report in Japandi style.

**Goal:** All PDF export variants render cleanly and match the Japandi design system.

### Tasks (PR-sized)

- [x] **6.1** Server-side PDF generator with Japandi template (colors, fonts, spacing from design tokens)
- [x] **6.2** Export variants: blank test, answer key
- [x] **6.3** Export variants: student answers, attempt report with timing/overdue data
- [x] **6.4** Add UI export actions (download links/buttons) on test detail and attempt pages

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/pdf/test/:id?variant=blank\|answerKey` | Export test PDF |
| `GET` | `/api/pdf/attempt/:attemptId?variant=student\|report` | Export attempt PDF |

### Acceptance Criteria

- [x] All 4 PDF variants generate correctly with Japandi styling
- [x] PDFs include bilingual explanations where configured
- [x] Timing/overdue data appears in attempt report variant
- [x] Download triggers cleanly from UI buttons

---

## Phase 7 — Expansion (Advanced Features + Security) ✅ COMPLETE

> Dark theme, i18n, analytics, mobile responsive, test sharing, bulk import, deduplication, security hardening.

**Goal:** Expand the platform with quality-of-life features: dark theme toggle, 4-language UI (EN/KO/RU/ES), analytics dashboard with AnyChart, mobile-responsive layout, public test sharing, spreadsheet-based bulk import, question deduplication, and OWASP security hardening.

### 7.1 Security Hardening ✅

- [x] Helmet with Content Security Policy (script-src, style-src, font-src, img-src, connect-src)
- [x] Custom NoSQL injection sanitizer for body, params, and query (Express 5 compatible)
- [x] JSON body size limit (1mb)
- [x] JWT secret: crash on startup if not set (no insecure fallback)
- [x] Auth-gated file serving (documents behind requireAuth, temp files not served)
- [x] Path traversal protection on bulk import confirm (previewId sanitization)
- [x] Docker Compose passes all required auth env vars with NODE_ENV=production
- [x] Removed isAdmin from JWT payload (checked from DB on each request)

### 7.2 Dark Theme ✅

- [x] Dual token sets: lightColors + darkColors in tokens.js
- [x] ThemeContext with system/light/dark mode cycling, localStorage persistence
- [x] Theme toggle button in nav (unicode glyphs: ○/●/◐)
- [x] prefers-color-scheme media query listener for system mode

### 7.3 Multi-Language UI (i18n) ✅

- [x] react-i18next + i18next with LanguageDetector
- [x] 4 languages: English, Korean (한국어), Russian (РУ), Spanish (ES)
- [x] ~170 translation keys across all namespaces
- [x] Language cycling button in nav
- [x] All pages, modals, command palette, shortcuts modal localized

### 7.4 Mobile Responsive ✅

- [x] Breakpoints: mobile (480px), tablet (768px), laptop (1024px)
- [x] Responsive grid layouts (Home, TestTaker, CommandPalette)
- [x] Sticky bottom controls on mobile TestTaker
- [x] Compressed nav bar on mobile

### 7.5 Analytics Dashboard ✅

- [x] AnyChart charts: accuracy over time (line), score by unit (bar), question type (radar)
- [x] 4 KPI cards: total attempts, average score, current streak, weakest unit
- [x] Period filter (7d/30d/90d/all)
- [x] Code-split via React.lazy (AnyChart ~2.5MB chunk)
- [x] Stats API with MongoDB aggregation pipelines
- [x] User preferences API (language, theme)

### 7.6 Test Sharing ✅

- [x] shareId field on Test schema (nanoid, unique sparse)
- [x] POST /:id/share generates share link
- [x] GET /shared/:shareId public test view (no auth required)
- [x] SharedTest page with "Start Practice" button

### 7.7 Bulk Import ✅

- [x] Template download (XLSX with ExcelJS)
- [x] Upload + parse XLSX/CSV with validation
- [x] Preview table with error/duplicate warnings
- [x] Confirm import creates Test documents
- [x] Dedup check against existing DB questions

### 7.8 Question Deduplication ✅

- [x] Dice coefficient similarity (string-similarity)
- [x] Korean text normalization (preserves Hangul Unicode)
- [x] Admin scan UI with threshold slider and cluster cards
- [x] "Keep Both" dismiss per cluster

### 7.9 404 Page + Error Handling ✅

- [x] Catch-all route with translated "Page not found" message
- [x] User-friendly error messages (no raw Mongoose errors)
- [x] Admin pages properly redirect unauthenticated users via useEffect
- [x] Auth-gated API calls don't fire for unauthenticated users

### Dependencies Added

| Package | Purpose |
|---------|---------|
| `react-i18next`, `i18next`, `i18next-browser-languagedetector` | Multi-language UI |
| `anychart`, `anychart-react` | Analytics charts |
| `exceljs`, `papaparse` | Bulk import (XLSX/CSV) |
| `string-similarity` | Question deduplication |
| `nanoid` | Share link IDs |
| `helmet` | HTTP security headers |

---

## Full Acceptance Criteria Snapshot

1. ✅ A deployed production instance runs on the home server with Docker Compose and persists data across restarts.
2. ✅ CI runs on every PR and deploys on main with Playwright passing.
3. ✅ Users can find any test quickly using search and Ctrl+P; keyboard shortcut list appears via Ctrl+K.
4. ✅ Sessions are resumable across devices without timer reset via refresh.
5. ✅ Admin can generate, validate, edit, and publish tests; users can privately flag issues.
6. ✅ All PDF export variants render cleanly and match the Japandi design system.
7. ✅ Dark/light/system theme toggle works; 4-language UI cycles correctly; analytics dashboard loads with AnyChart; tests can be shared via public links; admin can bulk import from XLSX/CSV; duplicate questions are detectable; security hardening passes audit.

---

## Dependencies Summary

| Phase | New Packages (estimated) |
|-------|-------------------------|
| Phase 0 | `express-validator` (already installed) |
| Phase 1 | nginx (Docker), GitHub Actions or similar CI |
| Phase 2 | None (React + Mongoose changes) |
| Phase 3 | None (schema + UI changes) |
| Phase 4 | None (admin routes + UI) |
| Phase 5 | `passport`, `passport-google-oauth20`, `cookie-parser` (already installed in Phase 4) |
| Phase 6 | `pdfkit` (PDF generation) |
| Phase 7 | `react-i18next`, `i18next`, `i18next-browser-languagedetector`, `anychart`, `anychart-react`, `exceljs`, `papaparse`, `string-similarity`, `nanoid`, `helmet` |
