# KIIP Study

A desktop-first practice test platform for the Korea Immigration and Integration Program (KIIP) Level 2 exam. Built with a Japandi (Japanese warm minimalism) design aesthetic.

## Features

- **AI Test Generation** from pasted text or uploaded documents (PDF, DOCX, TXT, MD) via Google Gemini 2.5 Flash (admin-only)
- **5 Question Types** — MCQ single, MCQ multiple, short answer, ordering, fill-in-the-blank
- **Practice Mode** with instant feedback and explanations
- **Test Mode** with timed 30-minute sessions and submit-at-end review
- **Endless Mode** — continuous random questions with configurable filters
- **Resumable Sessions** — progress saved server-side, resume across devices
- **Google OAuth** authentication with JWT httpOnly cookies
- **Per-User Progress** — attempt history, scores, duration tracking
- **Analytics Dashboard** with accuracy trends, unit breakdown, and per-question-type stats (AnyChart)
- **Admin Suite** — test editor (all 5 types), flags moderation, audit logging
- **PDF Exports** — blank test, answer key, student review, attempt report (Japandi-styled)
- **Bulk Import** — XLSX/CSV spreadsheet import with question deduplication scan
- **Test Sharing** via public nanoid links
- **4 Languages** — English, Korean, Russian, Spanish (react-i18next)
- **Theme Toggle** — light, dark, and system modes
- **Keyboard Navigation** — Ctrl+P command palette, Ctrl+K shortcuts modal
- **Mobile Responsive** — touch-friendly layout with responsive breakpoints
- **Image Support** for visual questions (up to 20 images per test, auto-optimized)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, styled-components 6, React Router 7 |
| Backend | Express 5, Mongoose 9, Node.js |
| Database | MongoDB 7 |
| AI | Google Gemini 2.5 Flash |
| Auth | Google OAuth 2.0, JWT (httpOnly cookies) |
| i18n | react-i18next (EN, KO, RU, ES) |
| Charts | AnyChart / anychart-react |
| PDF | PDFKit (server-side generation) |
| Testing | Playwright E2E (95+ tests) |
| Deployment | Docker Compose + Caddy (automatic HTTPS) |

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env
# Edit .env — add your GEMINI_API_KEY, Google OAuth credentials, JWT_SECRET
docker-compose up -d
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
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key |
| `PORT` | No | `5000` | Express server port |
| `MONGO_URI` | No | `mongodb://localhost:27017/kiip_test_app` | MongoDB connection |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth client secret |
| `JWT_SECRET` | Yes | — | Secret for JWT cookies |
| `ADMIN_EMAIL` | Yes | — | Email granted admin role on first login |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend origin (CORS + OAuth) |

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
npm test                     # Run Playwright E2E tests (Chromium)
npm run test:all             # Run tests on all browsers
npm run test:headed          # Run tests with visible browser
npm run test:ui              # Open Playwright UI mode
cd client && npm run build   # Production build
cd client && npm run lint    # Lint client code
```

## Project Structure

```
kiip_test_app/
├── client/                     React 19 frontend (Vite)
│   └── src/
│       ├── pages/              Route pages (Home, TestTaker, Dashboard, CreateTest, etc.)
│       ├── components/         Reusable UI (CommandPalette, ErrorBoundary, Toast, etc.)
│       ├── context/            AuthContext, ThemeContext
│       ├── i18n/               Locales (en, ko, ru, es)
│       ├── theme/              Design tokens, GlobalStyles, breakpoints
│       └── utils/              api.js (axios + interceptors), scoring.js
├── server/                     Express 5 backend
│   ├── models/                 Test, Attempt, User, TestSession, Flag, AuditLog
│   ├── routes/                 tests, auth, admin, sessions, flags, stats, share, pdf, bulkImport
│   ├── middleware/             Auth guards (requireAuth, requireAdmin)
│   └── utils/                  Auto-importer, deduplication
├── tests/                      Playwright E2E specs
├── scripts/                    Setup and utility scripts
├── docker-compose.yaml         Full-stack deployment
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
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/google/start` | Initiate Google OAuth |
| `POST` | `/api/auth/logout` | Clear session |
| `PATCH` | `/api/auth/preferences` | Update user preferences |

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

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats?period=` | Dashboard analytics |
| `POST` | `/api/tests/:id/share` | Generate share link |
| `GET` | `/api/shared/:shareId` | Public test metadata |
| `GET` | `/api/pdf/test/:id?variant=` | Export test PDF |
| `GET` | `/api/pdf/attempt/:attemptId?variant=` | Export attempt PDF |
| `GET` | `/api/health` | Health check |

## Design System

Japanese Warm Minimalism (Japandi) — design tokens in `client/src/theme/tokens.js`:

- **Canvas:** `#F7F2E8` | **Surface:** `#FFFFFF` | **Alt:** `#FAF7F1`
- **Text:** primary `#1F2328`, muted `#5B5F64`, faint `#7B8086`
- **Accents:** clay `#A0634A`, moss `#657655`, indigo `#2A536D`
- **Font:** Inter, BIZ UDPGothic, system-ui
- **Radii:** sm 10px, md 14px, lg 18px
- **Motion:** 120ms fast, 160ms base, ease-out

## License

MIT
