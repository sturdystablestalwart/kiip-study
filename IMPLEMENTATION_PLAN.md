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

## Phase 3 — Exam-Accurate Formats + Endless Mode

> Written question types, missed-only review, endless mode with pools and repetition control.

**Goal:** Support all KIIP paper question types and offer an endless practice mode drawing from the full library.

### Tasks (PR-sized)

- [ ] **3.1** Define question type enum + schema validation (MCQ single, MCQ multiple, short answer, ordering, fill-in-the-blank)
- [ ] **3.2** Implement MCQ single and multiple correct rendering + scoring
- [ ] **3.3** Implement at least one additional written type (short answer or ordering) based on KIIP source materials
- [ ] **3.4** Update TestTaker UI to render per-type interaction widgets
- [ ] **3.5** Update scoring logic per question type
- [ ] **3.6** Add "missed questions only" review flow after attempts
- [ ] **3.7** Endless mode: start session selecting theme/unit OR random
- [ ] **3.8** Endless mode: draw from full public library pool with recent-window exclusion (last ~30 questions)
- [ ] **3.9** Endless mode: chunked submissions (every N questions) to create attempts for tracking

### Data Model Changes

**Question types supported:**
- MCQ (single correct)
- MCQ (multiple correct)
- Short answer / fill-in
- Ordering / sequence
- Fill-in-the-blank

### Acceptance Criteria

- At least 3 question types render correctly with proper scoring
- Endless mode draws non-repeating questions from the full library
- Missed-only review shows only incorrect answers for re-practice

---

## Phase 4 — Admin Suite

> Generation, import, editing, validation, flags moderation.

**Goal:** Admin can generate, validate, edit, and publish tests; users can privately flag issues.

### Tasks (PR-sized)

- [ ] **4.1** Admin route guard + role check middleware (`isAdmin` on User model)
- [ ] **4.2** Admin import: upload PDF/TXT/MD (2 MB max) → extract text → preview → delete source file after extraction
- [ ] **4.3** Admin generate: AI generates test matching source question count or admin-selected count
- [ ] **4.4** AI response validation + retry + fallback; max 2 additional validation passes
- [ ] **4.5** Admin editor: full CRUD on test metadata, questions, options, correct answers, explanations; reorder/add/remove; structural validation (option counts, at least one correct)
- [ ] **4.6** Admin flags queue: view user-submitted flags, resolve/dismiss with optional notes

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/admin/tests/import` | Upload + extract preview |
| `POST` | `/api/admin/tests/generate` | AI generation |
| `PATCH` | `/api/admin/tests/:id` | Edit everything |
| `DELETE` | `/api/admin/tests/:id` | Delete test |
| `POST` | `/api/flags` | User submits flag |
| `GET` | `/api/admin/flags` | Admin views flag queue |
| `PATCH` | `/api/admin/flags/:id` | Resolve/dismiss flag |

### Acceptance Criteria

- Only admins can access generation/import/editing routes
- Extracted text preview shows before generation starts
- AI validation catches structural issues in generated tests
- Flag queue displays all open flags with resolution workflow

---

## Phase 5 — Auth + Continuity + Audit

> Google OAuth, JWT cookies, cross-device sessions, audit logs.

**Goal:** Sessions are resumable across devices without timer reset; admin actions are audited.

### Tasks (PR-sized)

- [ ] **5.1** Google OAuth flow + User creation (`email`, `googleId`, `isAdmin`, `createdAt`)
- [ ] **5.2** JWT cookie session management and `/me` endpoint (httpOnly cookies)
- [ ] **5.3** Anonymous progress migration on first login (merge existing attempts)
- [ ] **5.4** AuditLog collection + middleware to record admin actions (create/edit/delete/generate/resolve)
- [ ] **5.5** TestSession model: persist remaining time server-side; refresh restores timer
- [ ] **5.6** Prevent duplicate active sessions per user per test
- [ ] **5.7** Submit creates Attempt and closes session atomically

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/google/start` | Initiate OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback |
| `POST` | `/api/auth/logout` | Clear session |
| `POST` | `/api/sessions/start` | Start test/endless session |
| `PATCH` | `/api/sessions/:id` | Save progress |
| `POST` | `/api/sessions/:id/submit` | Submit → create Attempt |
| `GET` | `/api/attempts?cursor=&limit=` | Dashboard attempt feed |

### Data Model Additions

- **User** — `{ email, googleId, isAdmin, createdAt }`
- **TestSession** — resumable in-progress state per user (per test or endless)
- **AuditLog** — append-only admin and sensitive event log

### Acceptance Criteria

- Google OAuth login works; JWT stored in httpOnly cookie
- Session persists across devices; timer state survives refresh
- Anonymous attempts migrate to user account on first login
- Audit log records all admin mutations

---

## Phase 6 — PDF Exports

> Export blank/answer key/student answers/attempt report in Japandi style.

**Goal:** All PDF export variants render cleanly and match the Japandi design system.

### Tasks (PR-sized)

- [ ] **6.1** Server-side PDF generator with Japandi template (colors, fonts, spacing from design tokens)
- [ ] **6.2** Export variants: blank test, answer key
- [ ] **6.3** Export variants: student answers, attempt report with timing/overdue data
- [ ] **6.4** Add UI export actions (download links/buttons) on test detail and attempt pages

### API Changes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/pdf/test/:id?variant=blank\|answerKey` | Export test PDF |
| `GET` | `/api/pdf/attempt/:attemptId?variant=blank\|withKey\|student\|report` | Export attempt PDF |

### Acceptance Criteria

- All 4 PDF variants generate correctly with Japandi styling
- PDFs include bilingual explanations where configured
- Timing/overdue data appears in attempt report variant
- Download triggers cleanly from UI buttons

---

## Full Acceptance Criteria Snapshot

1. A deployed production instance runs on the home server with Docker Compose and persists data across restarts.
2. CI runs on every PR and deploys on main with Playwright passing.
3. Users can find any test quickly using search and Ctrl+P; keyboard shortcut list appears via Ctrl+K.
4. Sessions are resumable across devices without timer reset via refresh.
5. Admin can generate, validate, edit, and publish tests; users can privately flag issues.
6. All PDF export variants render cleanly and match the Japandi design system.

---

## Dependencies Summary

| Phase | New Packages (estimated) |
|-------|-------------------------|
| Phase 0 | `express-validator` (already installed) |
| Phase 1 | nginx (Docker), GitHub Actions or similar CI |
| Phase 2 | None (React + Mongoose changes) |
| Phase 3 | None (schema + UI changes) |
| Phase 4 | None (admin routes + UI) |
| Phase 5 | `passport`, `passport-google-oauth20`, `cookie-parser` (or similar OAuth lib) |
| Phase 6 | `puppeteer` or `pdfkit` or `@react-pdf/renderer` (PDF generation) |
