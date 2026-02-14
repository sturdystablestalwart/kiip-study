# KIIP Study

A desktop-first practice test platform for the Korea Immigration and Integration Program (KIIP) Level 2 exam. Paste Korean study material or upload a document, and the app generates interactive multiple-choice tests using Google Gemini AI.

Built with a Japandi (Japanese warm minimalism) design aesthetic.

## Features

- **AI Test Generation** from pasted text or uploaded documents (PDF, DOCX, TXT, MD)
- **Practice Mode** with instant feedback and explanations after each answer
- **Test Mode** with timed 30-minute sessions and submit-at-end review
- **Image Support** for visual questions (up to 20 images per test)
- **Attempt Tracking** with scores, duration, and overdue time
- **5 Sample Tests** auto-imported on first startup
- **Docker Compose** deployment for easy setup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, styled-components 6, React Router 7 |
| Backend | Express 5, Mongoose 9, Node.js |
| Database | MongoDB 7 |
| AI | Google Gemini 2.5 Flash |
| Testing | Playwright E2E (35 tests) |
| Deployment | Docker Compose |

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
docker-compose up -d
```

Open http://localhost:5173

### Manual

```bash
npm run install-all
```

Create `server/.env`:
```
GEMINI_API_KEY=your_key_here
MONGO_URI=mongodb://localhost:27017/kiip_test_app
```

```bash
npm start
```

Frontend: http://localhost:5173 | API: http://localhost:5000

## Project Structure

```
kiip_test_app/
├── client/                     React 19 frontend (Vite)
│   └── src/
│       ├── pages/              Home, CreateTest, TestTaker
│       ├── components/         Reusable UI components
│       └── theme/              Japandi design tokens
├── server/                     Express 5 backend
│   ├── models/                 Test + Attempt schemas
│   ├── routes/tests.js         API endpoints + Gemini integration
│   └── utils/autoImporter.js   Sample test loader
├── additionalContext/          Docs + 5 sample KIIP tests
├── tests/                      Playwright E2E specs
└── docker-compose.yaml         Full-stack deployment
```

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/tests` | List all tests |
| `GET` | `/api/tests/:id` | Get test with questions |
| `POST` | `/api/tests/generate` | Generate from text |
| `POST` | `/api/tests/generate-from-file` | Generate from document |
| `POST` | `/api/tests/upload` | Upload image |
| `POST` | `/api/tests/:id/attempt` | Save attempt |
| `DELETE` | `/api/tests/:id` | Delete test |
| `GET` | `/health` | Health check |

## Roadmap

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the full 6-phase roadmap:

1. **Production Foundation** — Docker, CI, home server deploy
2. **Instant Library UX** — Dashboard, search, Ctrl+P palette, Ctrl+K shortcuts
3. **Exam-Accurate Formats** — New question types, endless mode
4. **Admin Suite** — Generation, editing, moderation, flags
5. **Auth + Continuity** — Google OAuth, cross-device sessions, audit logs
6. **PDF Exports** — Blank, answer key, student answers, attempt report

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | — |
| `PORT` | No | `5000` |
| `MONGO_URI` | No | `mongodb://localhost:27017/kiip_test_app` |
| `VITE_API_URL` | No | `http://localhost:5000` |

## License

MIT
