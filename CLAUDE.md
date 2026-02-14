# CLAUDE.md — KIIP Test Application

## Project Summary

KIIP Study is a desktop-first MERN-stack KIIP exam practice platform with a public, admin-curated test library and per-user progress (attempts + resumable sessions). Test generation is admin-only. The UX prioritizes fast access to a large library via a dashboard plus keyboard-first navigation (Ctrl+P palette, Ctrl+K shortcuts). The app deploys on a home server via Docker Compose with a CI pipeline.

**Current state:** Users can paste text or upload documents, the app calls Gemini AI to generate MCQ tests, and users take tests in Practice or Test mode with a 30-minute timer. Auth, admin suite, endless mode, and PDF exports are planned (see `IMPLEMENTATION_PLAN.md`).

**Design aesthetic:** Japanese Warm Minimalism (Japandi) — warm off-white canvas, muted earth accents, minimal clutter, calm feedback. See design tokens in `client/src/theme/tokens.js`.

**Product principles:** Desktop-first, keyboard-first. Public test library. Admin-only generation. Korean questions with bilingual explanations. No listening/speaking, no spaced repetition, no gamification.

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
│   ├── project_context.md      # Project vision, decisions, requirements, data model
│   ├── SETUP_AND_USAGE.md      # Setup guide, Docker, env vars, troubleshooting
│   ├── KIIP_Study_Requirements_Roadmap_Checklist.docx  # Full requirements & roadmap (source of truth)
│   └── tests/                  # 5 sample KIIP Level 2 tests (.md), auto-imported on startup
├── tests/                      # Playwright E2E tests
│   └── app.spec.js             # 35 E2E tests (home, create, test-taking, practice, exit, delete, errors, a11y)
├── IMPLEMENTATION_PLAN.md      # Phased roadmap: Phase 0 (stabilization) + Phases 1–6 (features)
├── docker-compose.yaml         # Full-stack Docker deployment
├── .env.example                # Root env template (GEMINI_API_KEY)
└── package.json                # Root monorepo scripts (concurrently)
```

---

## Key Documentation Files

| File | Purpose |
|------|---------|
| `additionalContext/KIIP_Study_Requirements_Roadmap_Checklist.docx` | **Source of truth** — full requirements, product principles, data model, API spec, 6-phase roadmap |
| `additionalContext/project_context.md` | Project vision, product decisions, functional requirements, data model (current + planned) |
| `additionalContext/SETUP_AND_USAGE.md` | Setup (Docker & manual), usage guide, env vars, API reference, troubleshooting |
| `IMPLEMENTATION_PLAN.md` | Phased roadmap: Phase 0 (stabilization) + Phases 1–6 (features), PR-sized checklist |
| `additionalContext/tests/` | 5 sample KIIP Level 2 test files auto-imported on server startup |

---

## Tech Stack & Dependencies

### Frontend (`client/`)
- **React 19** with React Router DOM 7
- **Vite** (rolldown-vite 7.2.5) — `npm run dev` on port 5173
- **styled-components 6** — All styling is CSS-in-JS, scoped per component
- **axios** — HTTP client for API calls
- No external state management (React hooks only)

### Backend (`server/`)
- **Express 5** on port 5000
- **Mongoose 9** (MongoDB ODM)
- **@google/generative-ai** — Gemini 2.5 Flash for test generation
- **multer 2** — File uploads (images + documents)
- **pdf-parse** / **mammoth** — Document text extraction
- **express-validator** / **express-rate-limit** — Validation & rate limiting
- bcryptjs / jsonwebtoken installed but not yet used (auth planned)

### Testing & Tooling
- **Playwright** (`@playwright/test`) — E2E tests in `tests/`
- **concurrently** — Run client + server together via `npm start`
- **Docker Compose** — Full-stack deployment (mongo + server + client)

---

## Commands

```bash
# Install all dependencies (client + server)
npm run install-all

# Start both client and server (development)
npm start

# Start only server
npm run server

# Start only client
npm run client

# Client build
cd client && npm run build

# Lint client
cd client && npm run lint

# Run Playwright tests
npx playwright test
```

---

## API Endpoints

### Current Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/tests` | List all tests with last attempt |
| `GET` | `/api/tests/:id` | Get specific test with questions |
| `POST` | `/api/tests/generate` | Generate test from pasted text |
| `POST` | `/api/tests/generate-from-file` | Generate test from uploaded document |
| `POST` | `/api/tests/upload` | Upload single image |
| `POST` | `/api/tests/upload-multiple` | Upload up to 20 images |
| `POST` | `/api/tests/:id/attempt` | Save test attempt (score, answers, duration) |
| `DELETE` | `/api/tests/:id` | Delete test and all attempts |

Rate-limited: `/generate` and `/generate-from-file` (10 req/min).

### Planned Endpoints (See IMPLEMENTATION_PLAN.md)

**Public (Phase 2):** `GET /api/tests?level=&unit=&q=&cursor=&limit=` — server-side search + cursor pagination

**Auth (Phase 5):** `GET /api/auth/me`, `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `POST /api/auth/logout`

**Sessions (Phase 5):** `POST /api/sessions/start`, `PATCH /api/sessions/:id`, `POST /api/sessions/:id/submit`, `GET /api/attempts?cursor=&limit=`

**Flags (Phase 4):** `POST /api/flags`, `GET /api/admin/flags`, `PATCH /api/admin/flags/:id`

**Admin (Phase 4):** `POST /api/admin/tests/import`, `POST /api/admin/tests/generate`, `PATCH /api/admin/tests/:id`, `DELETE /api/admin/tests/:id`

**PDF (Phase 6):** `GET /api/pdf/test/:id?variant=blank|answerKey`, `GET /api/pdf/attempt/:attemptId?variant=blank|withKey|student|report`

---

## Database Schemas

### Current Collections

**Test** — `{ title, category, description, questions: [{ text, image?, options: [{ text, isCorrect }], explanation?, type }], createdAt }`

**Attempt** — `{ testId (ref→Test), score, totalQuestions, duration, overdueTime, answers: [{ questionIndex, selectedOption, isCorrect, isOverdue }], mode ('Practice'|'Test'), createdAt }`

### Planned Collections (See IMPLEMENTATION_PLAN.md)

**User** (Phase 5) — `{ email, googleId, isAdmin, createdAt }`

**TestSession** (Phase 5) — resumable in-progress state per user (per test or endless); persists remaining time server-side

**Flag** (Phase 4) — `{ userId, testId, questionIndex?, reason, note?, status ('open'|'resolved'|'dismissed'), resolution?, createdAt }`

**AuditLog** (Phase 5) — append-only log for admin actions (create/edit/delete/generate/resolve flags)

### Question Types

- MCQ single correct (current)
- MCQ multiple correct (planned — Phase 3)
- Short answer / fill-in (planned — Phase 3)
- Ordering / sequence (planned — Phase 3)
- Fill-in-the-blank (planned — Phase 3)

---

## Environment Variables

| Variable | File | Required | Default |
|----------|------|----------|---------|
| `GEMINI_API_KEY` | `server/.env` | Yes | — |
| `PORT` | `server/.env` | No | `5000` |
| `MONGO_URI` | `server/.env` | No | `mongodb://localhost:27017/kiip_test_app` |
| `VITE_API_URL` | `client/.env` | No | `http://localhost:5000` |

**Planned (Phase 5):**

| Variable | File | Required | Default |
|----------|------|----------|---------|
| `GOOGLE_CLIENT_ID` | `server/.env` | For auth | — |
| `GOOGLE_CLIENT_SECRET` | `server/.env` | For auth | — |
| `JWT_SECRET` | `server/.env` | For auth | — |

---

## Design System (Japandi Tokens)

Design tokens live in `client/src/theme/tokens.js`. Key values:

- **Canvas:** `#F7F2E8` — **Surface:** `#FFFFFF` — **Surface alt:** `#FAF7F1`
- **Text:** primary `#1F2328`, muted `#5B5F64`, faint `#7B8086`
- **Accents:** clay `#A0634A`, moss `#657655`, indigo `#2A536D`
- **States:** success `#2F6B4F`, warning `#B07A2A`, danger `#B43A3A`
- **Font:** Inter, BIZ UDPGothic, system-ui fallback
- **Radii:** sm 10px, md 14px, lg 18px, pill 999px
- **Shadows:** soft only (no harsh shadows)
- **Control heights:** buttons 44px, inputs 48px
- **Motion:** 120ms fast, 160ms base, ease-out (respects `prefers-reduced-motion`)
- **Max width:** 1040px — **Grid unit:** 8px

**Design rules:** No neon colors. No pure white background. No aggressive red. No harsh shadows. Microcopy should be warm and non-judgmental. All text must pass WCAG AA contrast. Focus rings use indigo `#2A536D`. Touch targets minimum 44px.

---

## Coding Conventions

### Styling
- **Always use styled-components** — no inline styles, no CSS modules, no Tailwind
- **Always use theme tokens** via `${props => props.theme.colors.*}` — never hardcode colors
- Global styles live in `client/src/theme/GlobalStyles.js`
- Components are styled-components defined at the top of each file

### React
- **Local state only** — useState, useEffect, useCallback (no Redux/Zustand)
- **Functional components only** — no class components
- **React Router v7** — useParams, useNavigate, Link
- **axios** for all API calls — import `API_BASE_URL` from `config/api.js`

### Backend
- **Express 5** patterns — async route handlers, error middleware
- **Mongoose 9** — schemas in `server/models/`, queries in `server/routes/tests.js`
- **Multer** for file uploads — configured in routes file
- Validation via `express-validator`

### General
- JavaScript (no TypeScript) — `.jsx` for React, `.js` for server
- No semicolons preference not enforced — existing code uses semicolons
- Keep components in `client/src/pages/` for route-level, `client/src/components/` for reusable
- Prefer editing existing files over creating new ones

---

## Workflow Rules (MANDATORY)

These rules are **non-negotiable**. Follow them automatically without the user asking.

### Context7 — Library Documentation Lookup
- **ALWAYS** use Context7 (`resolve-library-id` → `query-docs`) before writing code that uses external packages (styled-components, React Router, Mongoose, Express, Multer, Playwright, axios, Vite, @google/generative-ai, pdf-parse, mammoth, express-validator, express-rate-limit, etc.)
- **ALWAYS** use Context7 when encountering version-specific errors or deprecation warnings
- **ALWAYS** use Context7 when unsure about an API signature, config option, or library pattern
- Do NOT guess library APIs from memory — verify first

### Superpowers Skills — Use Proactively
- **`superpowers:brainstorming`** — ALWAYS invoke before creating new features, components, pages, or modifying user-facing behavior. This includes UI redesigns, new routes, new API endpoints, and any change to how the app looks or works.
- **`superpowers:writing-plans`** — ALWAYS invoke before multi-step implementation tasks (3+ files or significant logic changes). This is critical for tasks like "redesign the UI" or "add authentication."
- **`superpowers:verification-before-completion`** — ALWAYS invoke before claiming work is done, before committing, before creating PRs. Run `cd client && npm run build` and verify no errors. Run Playwright tests if applicable.
- **`superpowers:systematic-debugging`** — ALWAYS invoke when encountering any bug, test failure, build error, or unexpected behavior — before proposing fixes. Do not guess at solutions.
- **`superpowers:test-driven-development`** — Invoke before implementing features when Playwright tests exist in `tests/`. Write or update E2E tests to cover new behavior.
- **`superpowers:requesting-code-review`** — Invoke after completing major features or before merging branches
- **`superpowers:receiving-code-review`** — Invoke when receiving feedback — verify technical accuracy before implementing suggestions
- **`superpowers:finishing-a-development-branch`** — Invoke when implementation is complete and all tests pass

### Build & Verify
- After any frontend change, verify with `cd client && npm run build` — it must succeed
- After any backend change, verify the server starts without errors
- Before committing, check `cd client && npm run lint` passes
- Run `npx playwright test` for E2E verification when test files cover the changed area

### Git Practices
- Commit messages should be concise and describe the "why"
- Do not commit `.env` files, `node_modules/`, or `server/uploads/` contents
- Work on feature branches, not directly on `main`

---

## Available MCPs, Skills & Agent Dispatch (MANDATORY)

This section documents all available tooling. **Usage is non-negotiable** — these tools MUST be used as described. Do NOT skip them, do NOT substitute with manual alternatives.

### MCP Servers (Always Available)

| MCP | Tools | When to Use |
|-----|-------|-------------|
| **Context7** | `resolve-library-id` → `query-docs` | **ALWAYS** before writing code that uses any external package. Verify API signatures, config options, and patterns. Never guess from memory. |
| **Playwright** | `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_evaluate`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`, + more | **ALWAYS** for E2E testing, visual verification, UI debugging. Use `browser_snapshot` (accessibility tree) over screenshots for action-based interaction. Use `browser_take_screenshot` for visual verification. |

### Superpowers Skills (Invoke via Skill Tool)

These skills are **mandatory triggers** — invoke them at the specified moments, not optionally.

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `superpowers:brainstorming` | Before ANY creative/feature work | Explore intent, requirements, design before implementation |
| `superpowers:writing-plans` | Before multi-step tasks (3+ files) | Create structured implementation plans |
| `superpowers:executing-plans` | When executing a written plan | Execute with review checkpoints |
| `superpowers:test-driven-development` | Before implementing features | Write tests first, then implementation |
| `superpowers:systematic-debugging` | On ANY bug/failure/unexpected behavior | Diagnose root cause before proposing fixes |
| `superpowers:verification-before-completion` | Before claiming "done" / committing / PRs | Run build, lint, tests — evidence before assertions |
| `superpowers:requesting-code-review` | After completing major features | Verify work meets requirements |
| `superpowers:receiving-code-review` | When receiving feedback | Verify technical accuracy before implementing |
| `superpowers:finishing-a-development-branch` | When implementation + tests pass | Guide merge/PR/cleanup decisions |
| `superpowers:dispatching-parallel-agents` | When 2+ independent tasks exist | Parallelize via subagents |
| `superpowers:subagent-driven-development` | Executing plans with independent tasks | Coordinate parallel implementation |
| `superpowers:using-git-worktrees` | Starting isolated feature work | Create isolated git worktrees |

### Commit & Git Skills

| Skill | Purpose |
|-------|---------|
| `commit-commands:commit` | Create a git commit with proper message |
| `commit-commands:commit-push-pr` | Commit, push, and open a PR |
| `commit-commands:clean_gone` | Clean up branches marked as [gone] on remote |

### Agent Dispatch Patterns (via Task Tool)

The Task tool spawns subagents, each with **its own independent context window**. Use these for parallel, specialized work. The main agent (coordinator) dispatches and collects results — subagents report back to the coordinator.

> **Full agent catalog with prompts, scopes, and boundaries:** See [`docs/AGENTS.md`](docs/AGENTS.md). This is the **source of truth** for all agent prompts. Always copy the full prompt from that file when dispatching.

**Built-in agent types:**

| Agent Type | Use For |
|------------|---------|
| `Explore` | File discovery, pattern search, architecture understanding (read-only) |
| `Plan` | Designing approaches, identifying files, architectural trade-offs (read-only) |
| `general-purpose` | Any multi-step task — give it a specialized agent prompt from `docs/AGENTS.md` |
| `Bash` | Git operations, builds, installs, process management |
| `superpowers:code-reviewer` | Review completed work against plan and standards |

**Project-specific agents (dispatched as `general-purpose` with role prompts from `docs/AGENTS.md`):**

| # | Agent Name | Scope | Phase |
|---|-----------|-------|-------|
| 1 | `agent_product_spec` | PRD: scope, user stories, acceptance criteria | 0 |
| 2 | `agent_architect` | Architecture: services, models, API contracts | 0 |
| 3 | `agent_backend_api` | Backend: sessions, flags, audit models + routes | 1 |
| 4 | `agent_auth_security` | Auth: Google OAuth, JWT cookies, role guards | 1 |
| 5 | `agent_frontend_keyboard` | UX: Ctrl+P palette, Ctrl+K shortcuts, keyboard nav | 2 |
| 6 | `agent_home_dashboard` | UI: Home dashboard, search, pagination | 2 |
| 7 | `agent_sessions_timer` | Integration: resumable sessions, timer persistence | 2 |
| 8 | `agent_admin_panel` | UI: admin shell, import, generate, flags moderation | 3 |
| 9 | `agent_test_editor` | UI: admin test editing, validation, save | 3 |
| 10 | `agent_question_types` | Schema + UI: new question types, scoring | 2 |
| 11 | `agent_pdf_export` | Backend + UI: PDF generation, download buttons | 3 |
| 12 | `agent_devops_ci` | Infra: Docker, compose, GitHub Actions, deploy | 4 |
| 13 | `agent_qa_playwright` | Testing: Playwright E2E specs only | 4 |
| 14 | `agent_ui_polish` | Visual: tokens compliance, consistency, microcopy | 4 |
| 15 | `agent_migration` | Data: migration scripts, backward compatibility | 1 |
| 16 | `agent_repo_hygiene` | Cleanup: dead code, unused deps, conventions | 0 |
| 17 | `agent_dev_docs` | Docs: README, CONTRIBUTING, RUNBOOK, ENV | 0 |
| 18 | `agent_dev_reports` | Reports: deps, security checklist, changelog | 0 |

**Cross-agent dependency order (respect strictly):**

```
Phase 0 (parallel): agent_product_spec, agent_architect, agent_repo_hygiene, agent_dev_docs, agent_dev_reports
Phase 1 (after Phase 0): agent_migration, agent_auth_security, agent_backend_api
Phase 2 (after Phase 1): agent_sessions_timer, agent_home_dashboard, agent_frontend_keyboard, agent_question_types
Phase 3 (after Phase 2): agent_admin_panel, agent_test_editor, agent_pdf_export
Phase 4 (after Phase 3): agent_qa_playwright, agent_ui_polish, agent_devops_ci
```

**Model selection for agents:**
- `haiku` — Docs-only agents (1, 2, 16, 17, 18), simple searches
- `sonnet` — Most implementation agents (3-12, 15)
- `opus` — Complex architecture, security review, or quality-critical work (4, 13, 14)

**Dispatch rules:**
- **ALWAYS** copy the full agent prompt from `docs/AGENTS.md` — do not paraphrase or abbreviate
- **ALWAYS** launch independent tasks in parallel (single message, multiple Task tool calls)
- **NEVER** duplicate work — if a subagent is researching something, the coordinator must not search for the same thing
- **ALWAYS** provide full context in the prompt (subagents do NOT see the main conversation unless specified)
- **ALWAYS** respect scope boundaries — if an agent's "Must NOT" list prohibits something, dispatch a different agent
- **Prefer `Explore` agent** for quick file/code searches over `general-purpose` when no editing is needed

### Verification Checklist (Run Before Every Completion Claim)

These checks are **mandatory** before saying work is done:

```
1. cd client && npm run build        # Must succeed — zero errors
2. cd client && npm run lint         # Must pass — zero warnings treated as errors
3. npx playwright test               # Must pass — when tests cover changed area
4. git status                        # Review — no unintended changes, no secrets
5. Playwright MCP browser_snapshot   # Visual — verify UI renders correctly (if UI changed)
```

---

## Common Pitfalls

- **Express 5** has breaking changes from v4 — error handling middleware signature is `(err, req, res, next)`, route params work differently
- **Mongoose 9** deprecated several methods — use `findOneAndDelete` not `findByIdAndRemove`
- **styled-components v6** — `createGlobalStyle` must be rendered as a component; theme access is `${props => props.theme.*}`
- **React Router v7** — uses `createBrowserRouter` / `RouterProvider` in newer patterns, but this app uses the `<BrowserRouter>` approach
- **Vite uses rolldown-vite** — aliased via `overrides` in `client/package.json`
- **GEMINI_API_KEY** must be set in `server/.env` — AI endpoints will fail silently otherwise
- **MongoDB must be running** — the server will crash on startup without it
- **Auto-importer** reads from `additionalContext/tests/` on startup — don't put non-test files there
- **Roadmap source of truth** is `additionalContext/KIIP_Study_Requirements_Roadmap_Checklist.docx` — check it when requirements are unclear
- **Admin-only generation** is the target model — current open generation will be gated behind auth in Phase 4/5
