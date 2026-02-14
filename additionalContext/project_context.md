# Project Context: KIIP Study

## Overview

KIIP Study is a desktop-first MERN-stack KIIP exam practice platform with a public, admin-curated test library and per-user progress (attempts + resumable sessions). Test generation is admin-only. The user experience prioritizes fast access to a large library via a dashboard plus keyboard-first navigation (Ctrl+P palette, Ctrl+K shortcuts). The app is designed in a Japandi aesthetic and deploys on a home server via Docker Compose with a polished CI pipeline.

**Owner:** Alex Reznitskii | **Version:** 2.0 | **Date:** 2026-02-15

---

## Product Principles

| Item | Decision |
|------|----------|
| Primary persona | KIIP self-learner |
| Core value | Practice tests effectively and track mastery |
| Library model | All tests are public; progress is per-user |
| Generator access | Admin-only |
| Platform target | Desktop-first; keyboard-first |
| Aesthetic | Japandi: warm minimalism, off-white canvas `#F7F2E8`, earth-tone accents |
| Non-goals | No listening/speaking; no spaced repetition; no recommendations; no gamification |

---

## Confirmed Decisions (from Alignment Q&A)

| Item | Decision |
|------|----------|
| Question language | Korean questions; explanations bilingual (EN + optional KO) |
| Question types | All KIIP paper (written) types, excluding listening/speaking |
| Timer | Default enabled; no pausing; configurable by admin; overdue tracked informationally |
| Practice mode | Show explanation immediately after answer selection; answers not changeable after feedback |
| Test mode | Submit early supported; no pauses; reveal after submit |
| Export | Export everything to PDF (blank, answer key, student answers, attempt report) in Japandi style |
| Editing | Admin can edit every detail; reorder/add/remove; validate structure; supports multiple correct where applicable |
| Uploads | Admin-only uploads; PDF/TXT/MD; max 2 MB; delete after extraction; show extracted text preview to admin |
| Flags | Users can flag issues privately to admin |
| Auth | Google OAuth + JWT; cross-device continuation required; audit logs required |

---

## Tech Stack

- **Frontend:** React 19 (Vite), styled-components 6, React Router DOM 7, axios
- **Backend:** Node.js, Express 5, Mongoose 9 (MongoDB)
- **AI:** Google Gemini 2.5 Flash (`@google/generative-ai`)
- **File processing:** multer 2, pdf-parse, mammoth
- **Validation:** express-validator, express-rate-limit
- **Auth (planned):** Google OAuth + JWT (passport, passport-google-oauth20)
- **Testing:** Playwright E2E
- **Deployment:** Docker Compose (mongo + server + client), nginx for production static serving
- **Design:** Japandi warm minimalism — tokens in `client/src/theme/tokens.js`

---

## Project Structure

```
kiip_test_app/
├── client/                     # React 19 frontend (Vite)
│   ├── src/
│   │   ├── pages/              # Route pages (Home, CreateTest, TestTaker)
│   │   ├── components/         # Reusable UI components
│   │   ├── theme/              # Design tokens & global styles
│   │   ├── config/api.js       # API base URL config
│   │   ├── App.jsx             # Router, ThemeProvider, AppShell
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Minimal CSS reset
│   ├── package.json
│   └── vite.config.js
├── server/                     # Express 5 backend
│   ├── models/
│   │   ├── Test.js             # Mongoose: Test + Question + Option schemas
│   │   └── Attempt.js          # Mongoose: Attempt + Answer schemas
│   ├── routes/tests.js         # All API endpoints
│   ├── utils/autoImporter.js   # Auto-loads .md/.txt from additionalContext/tests/
│   ├── uploads/                # Local file storage (images, documents)
│   └── index.js                # Server entry point
├── additionalContext/          # Project docs & sample test data
│   ├── project_context.md      # This file — project vision & decisions
│   ├── SETUP_AND_USAGE.md      # Setup guide, Docker, env vars, troubleshooting
│   ├── KIIP_Study_Requirements_Roadmap_Checklist.docx  # Full requirements & roadmap
│   └── tests/                  # 5 sample KIIP Level 2 tests (.md), auto-imported on startup
├── tests/                      # Playwright E2E tests
│   ├── app.spec.js
│   └── verify_app.js
├── IMPLEMENTATION_PLAN.md      # Phased roadmap (Phase 0–6)
├── CLAUDE.md                   # Claude Code context & coding conventions
├── docker-compose.yaml         # Full-stack Docker deployment
├── .env.example                # Root env template (GEMINI_API_KEY)
└── package.json                # Root monorepo scripts (concurrently)
```

---

## Current Implementation Status

### What Works Now
- Express 5 backend with MongoDB (Mongoose 9)
- Google Gemini AI integration for test generation from text and file uploads
- React 19 frontend with styled-components (Japandi design tokens)
- Practice mode (instant feedback) and Test mode (submit-to-reveal)
- 30-minute timer with overdue tracking
- Image uploads (single + batch up to 20)
- Document parsing (PDF, DOCX, TXT, MD)
- Test attempt tracking (score, duration, answers)
- Auto-import of sample tests from `additionalContext/tests/`
- Docker Compose deployment (mongo + server + client)
- Rate limiting on generation endpoints

### What's Planned (See IMPLEMENTATION_PLAN.md)
- **Phase 0:** Bug fixes, validation, error handling improvements
- **Phase 1:** Production Docker with nginx, CI pipeline, home server deployment
- **Phase 2:** Dashboard, server-side search, Ctrl+P palette, Ctrl+K shortcuts
- **Phase 3:** Additional question types (MCQ multi, short answer, ordering, fill-in-the-blank), endless mode
- **Phase 4:** Admin suite (generation, editing, moderation, flags)
- **Phase 5:** Google OAuth + JWT auth, cross-device sessions, audit logs
- **Phase 6:** PDF exports (blank, answer key, student answers, attempt report)

---

## Functional Requirements Summary

### 3.1 Public Test Library
- All tests visible to all users (public library)
- Home dashboard: "Continue last session" card + "Recent attempts" list
- Ctrl+P command palette (VSCode-style) for fast test access
- Ctrl+K global shortcuts modal
- Pagination/infinite scroll with server-side search

### 3.2 Test Taking
- Modes: Practice, Test, and Endless
- Practice: immediate explanation after selection; answers locked after feedback
- Test: submit at any time; full review after submit; no pauses
- Timer: default enabled; configurable by admin; overdue tracked informationally
- "Missed questions only" review flow after attempts

### 3.3 Endless Mode
- Select theme/unit or random; draw from full public library pool
- Recent-window exclusion to avoid repeats (~last 30 questions)
- Chunked submissions (every N questions) for tracking

### 3.4 Issue Flagging
- Users flag tests/questions with reason + optional note
- Flags private to admins; admin can resolve/dismiss with notes

### 3.5 Admin Suite
- Admin-only access gate (role-based)
- Upload PDF/TXT/MD (2 MB max); preview extracted text before generation
- AI generation with per-question regen; up to 2 validation passes
- Full test editor: metadata, questions, options, explanations; reorder/add/remove
- Moderation: flags queue with resolution workflow

### 3.6 Accounts & Cross-Device Continuation
- Google OAuth + JWT session management (httpOnly cookies)
- Per-user progress: attempts + resumable sessions across devices
- Anonymous progress migration on first login
- Audit logs for admin actions

### 3.7 PDF Export
- Variants: blank test, answer key, student answers, attempt report
- Japandi-styled templates with timing/overdue data

---

## Data Model (Current + Planned)

### Current Collections
- **Test** — `{ title, category, description, questions: [{ text, image?, options: [{ text, isCorrect }], explanation?, type }], createdAt }`
- **Attempt** — `{ testId, score, totalQuestions, duration, overdueTime, answers: [{ questionIndex, selectedOption, isCorrect, isOverdue }], mode, createdAt }`

### Planned Collections
- **User** — `{ email, googleId, isAdmin, createdAt }`
- **TestSession** — resumable in-progress state per user (per test or endless)
- **Flag** — user-submitted issue reports for admin review
- **AuditLog** — append-only admin and sensitive event log

### Question Types (Current + Planned)
- MCQ single correct (current)
- MCQ multiple correct (planned)
- Short answer / fill-in (planned)
- Ordering / sequence (planned)
- Fill-in-the-blank (planned)

---

## Design Palette (Japandi Tokens)

Design tokens live in `client/src/theme/tokens.js`:

- **Canvas:** `#F7F2E8` — **Surface:** `#FFFFFF` — **Surface alt:** `#FAF7F1`
- **Text:** primary `#1F2328`, muted `#5B5F64`, faint `#7B8086`
- **Accents:** clay `#A0634A`, moss `#657655`, indigo `#2A536D`
- **States:** success `#2F6B4F`, warning `#B07A2A`, danger `#B43A3A`
- **Font:** Inter, BIZ UDPGothic, system-ui fallback
- **Radii:** sm 10px, md 14px, lg 18px, pill 999px
- **Max width:** 1040px — **Grid unit:** 8px
- **Control heights:** buttons 44px, inputs 48px

**Rules:** No neon colors. No pure white background. No aggressive red. No harsh shadows. Warm microcopy. WCAG AA contrast. Focus rings indigo `#2A536D`. Touch targets min 44px.

---

## Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Performance | Responsive with hundreds of tests; server-side indexing; paginated endpoints |
| Reliability | Docker volumes persist data; source files deleted after extraction; backup/restore documented |
| Security | JWT in httpOnly cookies; rate limiting by IP and user; strict validation; MIME allowlists; audit log |
| UX | Desktop-first 1040px max width; Japandi tokens; 44px min touch targets; keyboard-first navigation |
