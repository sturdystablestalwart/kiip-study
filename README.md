# KIIP Study

A desktop-first practice test platform for the Korea Immigration and Integration Program (KIIP) Level 2 exam. Built with a Japandi (Japanese warm minimalism) design aesthetic.

## Status

- Phase 0–7 features: shipped ✅
- Active hardening track: [IMPLEMENTATION_PLAN_AUDIT_REMEDIATION.md](./IMPLEMENTATION_PLAN_AUDIT_REMEDIATION.md) (security, perf, ops, a11y)
- Open work, bugs and proposals: [GitHub Issues](https://github.com/sturdystablestalwart/kiip-study/issues)

## Features

- **AI Test Generation** from pasted text or uploaded documents (PDF, DOCX, TXT, MD) via Google Gemini 2.5 Flash (admin-only)
- **LLM Curriculum Classification** — each test is auto-classified by level/unit/contentType using Gemini structured output against the seeded KIIP curriculum (Levels 0–5 with unit-level taxonomy)
- **5 Question Types** — MCQ single, MCQ multiple, short answer, ordering, fill-in-the-blank
- **Practice Mode** with instant feedback and explanations
- **Test Mode** with timed 30-minute sessions and submit-at-end review
- **Endless Mode** — continuous random questions with configurable filters
- **Resumable Sessions** — progress saved server-side, resume across devices
- **Authentication** — Google OAuth **+ magic-link (passwordless email)** with JWT httpOnly cookies
- **Per-User Progress** — attempt history, scores, duration tracking, failed-questions review
- **Analytics Dashboard** with accuracy trends, unit breakdown, and per-question-type stats (AnyChart)
- **Admin Suite** — test editor (all 5 types), flags moderation, audit logging, duplicates scanner
- **PDF Exports** — blank test, answer key, student review, attempt report (Japandi-styled)
- **Bulk Import** — XLSX/CSV spreadsheet import with question deduplication scan
- **Test Sharing** via public nanoid links (admin-only generation)
- **4 Languages** — English, Korean, Russian, Spanish (react-i18next)
- **Theme Toggle** — light, dark, and system modes
- **Keyboard Navigation** — Ctrl+P command palette, Ctrl+K shortcuts modal
- **Mobile Responsive** — touch-friendly layout with responsive breakpoints
- **Image Support** for visual questions (up to 20 images per test, auto-optimized via sharp)
- **PWA** — installable, with offline-cached static assets (vite-plugin-pwa)
- **Unified Design System** — Button/Card/Badge/Modal/Stack/EmptyState primitives in `client/src/components/ui/`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite (rolldown-vite), styled-components 6, React Router 7, vite-plugin-pwa |
| Backend | Express 5, Mongoose 9, Node.js, pino (structured logs), morgan, compression |
| Database | MongoDB 7 |
| AI | Google Gemini 2.5 Flash (generation + curriculum classification) |
| Auth | Google OAuth 2.0 + magic-link (passwordless), JWT (httpOnly cookies), nodemailer |
| Security | helmet CSP, custom NoSQL sanitizer, Origin/Referer CSRF middleware, express-rate-limit |
| i18n | react-i18next (EN, KO, RU, ES) |
| Charts | AnyChart |
| PDF | PDFKit (server-side generation) |
| Image processing | sharp |
| Bulk import | exceljs, papaparse |
| Testing | Playwright E2E (122 tests across `app.spec.js` + `manual-audit.spec.js`) + Vitest unit tests on both client and server (jsdom, supertest, mongodb-memory-server, @axe-core/playwright) |
| Logging/Ops | pino structured logs, `safeError()` helper, graceful SIGTERM/SIGINT shutdown, helmet CSP, custom NoSQL sanitizer, Origin/Referer CSRF middleware |
| Deployment | Docker Compose + Caddy (automatic HTTPS) + GitHub Actions CI |

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY, Google OAuth credentials, JWT_SECRET
docker compose up -d
```

Open http://localhost

### Manual Setup

```bash
# Install all dependencies
npm run install-all

# Create server/.env from template
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Start both client and server
npm start
```

Frontend: http://localhost:5173 | API: http://localhost:5000

### Local Development Setup

```bash
# Interactive setup script (installs deps, creates .env files, checks MongoDB)
npm run setup
```

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key (generation + classification) |
| `PORT` | No | `5000` | Express server port |
| `MONGO_URI` | No | `mongodb://localhost:27017/kiip_test_app` | MongoDB connection |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | `/api/auth/google/callback` | OAuth callback path |
| `JWT_SECRET` | Yes | — | Secret for JWT cookies (long random string in prod) |
| `ADMIN_EMAIL` | Yes | — | Email granted admin role on first login (Google or magic-link) |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend origin (CORS + OAuth, comma-separated allowed) |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes (for magic-link) | — | SMTP credentials for magic-link email delivery |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `LOG_LEVEL` | No | `debug` (dev) / `info` (prod) | pino log level |

### Client (`client/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `http://localhost:5000` | Backend API base URL |

## Commands

```bash
npm run install-all          # Install client + server dependencies
npm start                    # Start both client and server
npm run server               # Start server only
npm run client               # Start client only
npm test                     # Run Playwright E2E (Chromium)
npm run test:all             # Run Playwright on all browsers
npm run test:headed          # Run Playwright with visible browser
npm run test:ui              # Open Playwright UI mode
npm run test:unit            # Run Vitest unit tests on both client and server
cd client && npm run build   # Production build
cd client && npm run lint    # Lint client code
cd client && npm run analyze # Build with bundle visualizer
cd server && npm run test    # Run server Vitest only
```

## Project Structure

```
kiip_test_app/
├── client/                     React 19 frontend (Vite, PWA)
│   └── src/
│       ├── pages/              Home, TestTaker, Dashboard, EndlessMode, CreateTest,
│       │                       FailedQuestions, SharedTest, MagicLinkVerify,
│       │                       AdminTestEditor, AdminFlags, AdminBulkImport, AdminDuplicates
│       ├── components/
│       │   ├── ui/             Unified primitives (Button, Card, Badge, Modal, Stack, EmptyState)
│       │   └── question-types/ MCQSingle, MCQMultiple, ShortAnswer, Ordering, FillInTheBlank
│       ├── context/            AuthContext, ThemeContext, SearchPaletteContext
│       ├── hooks/              useFocusTrap
│       ├── i18n/               Locales (en, ko, ru, es)
│       ├── theme/              tokens.js, GlobalStyles.js, breakpoints.js
│       └── utils/              api.js (axios + interceptors), scoring.js, anonymousAttempts.js
├── server/                     Express 5 backend
│   ├── models/                 Test, Attempt, User, TestSession, Flag, AuditLog, Curriculum, MagicLink
│   ├── routes/                 tests, auth (Google + magic-link), admin, sessions, flags, stats,
│   │                           share, pdf, bulkImport, duplicates, curriculum, review
│   ├── middleware/             auth (requireAuth/requireAdmin), sanitizer (NoSQL), originCheck (CSRF)
│   ├── utils/                  llm, llmValidator, classifier, scoring, pdfGenerator, safeError,
│   │                           logger (pino), magicLinkEmail (nodemailer), autoImporter, dedup,
│   │                           curriculumSeed
│   └── scripts/                migrateLegacyTests.js (one-time data migration)
├── docs/                       PROJECT_REPORT, AGENTS (historical), plans/, superpowers/
├── tests/                      Playwright E2E specs (app.spec.js + manual-audit.spec.js)
├── scripts/                    Setup and utility scripts
├── IMPLEMENTATION_PLAN.md      Phase 0–7 (complete) + Post-Phase-7 pointer
├── IMPLEMENTATION_PLAN_AUDIT_REMEDIATION.md  Active security/perf/ops remediation
├── docker-compose.yaml         Full-stack deployment (mongo + server + client + caddy + backup)
└── Caddyfile                   Reverse proxy with automatic HTTPS
```

## API Reference

### Tests
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tests?q=&level=&unit=&cursor=&limit=` | List tests (search, filter, paginate) |
| `GET` | `/api/tests/:id` | Get test with questions |
| `POST` | `/api/tests/:id/attempt` | Save test attempt |
| `GET` | `/api/tests/recent-attempts?limit=` | Recent attempts with metadata |
| `GET` | `/api/tests/endless?level=&unit=&exclude=&limit=` | Random question batch |
| `GET` | `/api/attempts?cursor=&limit=` | Paginated attempt history |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Current user info (returns `null` if not authed) |
| `GET` | `/api/auth/google/start` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback |
| `POST` | `/api/auth/magic/send` | Send magic-link email (`{ email, lang? }`) |
| `GET` | `/api/auth/magic/verify?token=` | Verify magic-link token → set JWT cookie |
| `POST` | `/api/auth/logout` | Clear session |
| `PATCH` | `/api/auth/preferences` | Update language/theme preferences |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions/start` | Start or resume session |
| `PATCH` | `/api/sessions/:id` | Save progress |
| `POST` | `/api/sessions/:id/submit` | Submit session |
| `GET` | `/api/sessions/active` | Active sessions |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/tests/generate` | AI generation from text |
| `POST` | `/api/admin/tests/generate-from-file` | AI generation from file |
| `POST` | `/api/admin/tests/upload` | Upload question image |
| `PATCH` | `/api/admin/tests/:id` | Edit test |
| `DELETE` | `/api/admin/tests/:id` | Delete test |
| `POST` | `/api/admin/tests/bulk-import` | Upload spreadsheet |
| `GET` | `/api/admin/duplicates?level=&threshold=` | Scan duplicates |
| `GET` | `/api/admin/flags` | View flag queue |
| `PATCH` | `/api/admin/flags/:id` | Resolve/dismiss flag |

### Curriculum (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/curriculum` | All KIIP levels with units |
| `GET` | `/api/curriculum/:level` | Units for a specific level |

### Review (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/review/failed?limit=` | Recent questions the user got wrong |
| `GET` | `/api/review/difficulty` | Average accuracy per test (community signal) |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats?period=7d\|30d\|90d\|all` | Dashboard KPIs + accuracy trend + unit breakdown |
| `GET` | `/api/stats/question-types` | Per-question-type accuracy |
| `POST` | `/api/tests/:id/share` | Generate share link (**admin-only**) |
| `GET` | `/api/shared/:shareId` | Public test metadata (rate-limited 30/min) |
| `GET` | `/api/pdf/test/:id?variant=blank\|answerKey` | Export test PDF |
| `GET` | `/api/pdf/attempt/:attemptId?variant=student\|report` | Export attempt PDF |
| `GET` | `/api/health` | Health check |

## Design System

Japanese Warm Minimalism (Japandi) — design tokens in `client/src/theme/tokens.js`:

- **Canvas:** `#F7F2E8` | **Surface:** `#FFFFFF` | **Alt:** `#FAF7F1`
- **Text:** primary `#1F2328`, muted `#5B5F64`, faint `#7B8086`
- **Accents:** clay `#A0634A`, moss `#657655`, indigo `#2A536D`
- **Font:** Inter, BIZ UDPGothic, system-ui
- **Radii:** sm 10px, md 14px, lg 18px
- **Motion:** 120ms fast, 160ms base, ease-out

## Release & Deploy

Production deploys are gated on **signed annotated tags** — a plain push to `main` no longer deploys.

```bash
# from a clean main, after CI is green
git tag -s v1.4.0 -m "v1.4.0"   # GPG-signed annotated tag
git push origin v1.4.0          # triggers .github/workflows/deploy.yml
```

The workflow SSHes into the deploy host, runs `git fetch --tags --force`, verifies the tag signature with `git verify-tag`, and checks out the tag's exact commit (detached HEAD) before running `docker compose build && up -d`. If the signature is invalid or missing, the deploy aborts before any container is touched.

**Manual escape hatch:** Actions → Deploy → *Run workflow* and supply a commit SHA. The dispatch input bypasses tag verification (trust comes from GitHub repo permissions), so use it only for hotfix rollbacks.

## License

MIT
