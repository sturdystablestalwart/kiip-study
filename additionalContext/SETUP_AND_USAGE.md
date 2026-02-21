# KIIP Test Application - Setup & Usage Guide

## Overview

KIIP Study is a desktop-first MERN-stack KIIP exam practice platform with a public, admin-curated test library and per-user progress. It uses AI (Google Gemini) to convert study materials into interactive practice tests.

**All six implementation phases are complete.** Features include: admin-only test generation from text and files, five question types (MCQ single/multi, short answer, ordering, fill-in-the-blank), Practice/Test/Endless modes with resumable sessions, Google OAuth auth, admin test editor and flags moderation, audit logging, PDF exports, Ctrl+P command palette, and Ctrl+K shortcuts.

---

## Quick Start with Docker (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Steps

1. **Clone the repository and navigate to the project:**
   ```bash
   cd kiip_test_app
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your Gemini API key:**
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```

5. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

6. **Stop the application:**
   ```bash
   docker-compose down
   ```

7. **Stop and remove all data:**
   ```bash
   docker-compose down -v
   ```

---

## Manual Setup (Development)

### Prerequisites
- Node.js 18+ installed
- MongoDB installed locally OR Docker for MongoDB only
- A Google Gemini API key

### Steps

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```
   Or manually:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Set up environment files:**

   **Server (`server/.env`):**
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/kiip_test_app
   GEMINI_API_KEY=your_gemini_api_key_here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   JWT_SECRET=your-jwt-secret-change-in-production
   ADMIN_EMAIL=admin@example.com
   CLIENT_URL=http://localhost:5173
   GOOGLE_CALLBACK_URL=/api/auth/google/callback
   ```

   **Client (`client/.env`):**
   ```
   VITE_API_URL=http://localhost:5000
   ```

3. **Start MongoDB:**

   Using Docker:
   ```bash
   docker run -d -p 27017:27017 --name kiip-mongo mongo:7
   ```

   Or start your local MongoDB service.

4. **Start the application:**
   ```bash
   npm start
   ```
   This starts both frontend and backend concurrently.

5. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

---

## Application Usage

### Creating a Test

1. Click **"+ Create Test"** on the home page
2. Choose one of two options:

   **Option A: Paste Text**
   - Paste Korean study material or mock test content
   - Minimum 200 characters required
   - Optionally upload images for visual questions (max 20 images, 10MB each)

   **Option B: Upload Document**
   - Upload a PDF, DOCX, TXT, or MD file (max 10MB)
   - The AI will extract text and generate questions

3. Click **"Generate Test"** and wait for AI processing (up to 2 minutes)

### Taking a Test

1. Click on any test card from the home page
2. Choose your mode:
   - **Test Mode**: Answers hidden until you submit; submit early supported; full review after submit
   - **Practice Mode**: Instant feedback after each answer; answers locked after feedback
3. Answer questions using the option buttons
4. Navigate using Previous/Next or the question dots at the bottom
5. Submit when ready (last question shows Submit button)

### Test Features

- **30-minute timer** (default enabled) with overdue tracking (informational, does not auto-submit)
- **Question navigation dots** to jump to any question
- **Mode switching** (resets progress with confirmation)
- **Exit warning** if you have unanswered questions
- **Score display** after submission with percentage

### Managing Tests

- **Delete**: Click the × button on any test card
- **View attempts**: Last score shown on each test card

### Keyboard Shortcuts

- **Ctrl+P**: Open command palette — type to search and jump to any test
- **Ctrl+K**: Show global keyboard shortcuts reference
- **1–4 / A–D**: Select answer option in MCQ questions
- **Arrow keys**: Navigate options in command palette

---

## Environment Variables Reference

### Root `.env` (for Docker Compose)
| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `JWT_SECRET` | Secret for signing JWT cookies | Yes |
| `ADMIN_EMAIL` | Email granted admin role on first login | Yes |
| `CLIENT_URL` | Frontend origin for CORS and OAuth redirect | No (`http://localhost:5173`) |
| `GOOGLE_CALLBACK_URL` | OAuth callback path | No (`/api/auth/google/callback`) |

### Server `.env`
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/kiip_test_app` |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |
| `JWT_SECRET` | Secret for signing JWT cookies | Required |
| `ADMIN_EMAIL` | Email granted admin role on first login | Required |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `GOOGLE_CALLBACK_URL` | OAuth callback path | `/api/auth/google/callback` |

### Client `.env`
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |

---

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `mongo` | 27017 | MongoDB database |
| `server` | 5000 | Express.js backend API |
| `client` | 5173 | Vite React frontend |

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f server

# Restart a service
docker-compose restart server

# Stop all services
docker-compose down

# Stop and remove volumes (deletes database)
docker-compose down -v

# Rebuild containers after code changes
docker-compose up -d --build
```

---

## API Endpoints

### Tests (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tests?q=&level=&unit=&cursor=&limit=` | List tests with search, filters, cursor pagination |
| `GET` | `/api/tests/:id` | Get specific test with questions |
| `GET` | `/api/tests/recent-attempts?limit=` | Recent attempts with test metadata |
| `POST` | `/api/tests/:id/attempt` | Save test attempt |
| `GET` | `/api/tests/endless?level=&unit=&exclude=&limit=` | Random batch for endless mode |
| `POST` | `/api/tests/endless/attempt` | Save endless chunk attempt |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Current user info |
| `GET` | `/api/auth/google/start` | Start Google OAuth flow |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |
| `POST` | `/api/auth/logout` | Clear session cookie |

### Sessions (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions/start` | Start a test or endless session |
| `PATCH` | `/api/sessions/:id` | Save progress |
| `POST` | `/api/sessions/:id/submit` | Submit and create Attempt |
| `GET` | `/api/sessions/active` | Get active session for current user |
| `DELETE` | `/api/sessions/:id` | Abandon session |
| `GET` | `/api/attempts?cursor=&limit=` | Paginated attempt history |

### Flags (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/flags` | Submit a flag on a question |

### Admin (Admin-only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/tests/import` | Import test from JSON |
| `POST` | `/api/admin/tests/generate` | AI generation from text |
| `POST` | `/api/admin/tests/generate-from-file` | AI generation from file |
| `POST` | `/api/admin/tests/upload` | Upload single image |
| `POST` | `/api/admin/tests/upload-multiple` | Upload image batch |
| `PATCH` | `/api/admin/tests/:id` | Edit test |
| `DELETE` | `/api/admin/tests/:id` | Delete test and all attempts |
| `GET` | `/api/admin/flags` | View flag queue |
| `GET` | `/api/admin/flags/count` | Open flags count |
| `PATCH` | `/api/admin/flags/:id` | Resolve or dismiss flag |
| `GET` | `/api/admin/audit` | Audit log |

### PDF Exports (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pdf/test/:id?variant=blank\|answerKey` | Export test PDF |
| `GET` | `/api/pdf/attempt/:attemptId?variant=student\|report` | Export attempt PDF |

---

## File Upload Limits

| Type | Max Size | Allowed Formats |
|------|----------|-----------------|
| Images | 10 MB | JPEG, PNG, GIF, WebP, BMP, TIFF |
| Documents | 10 MB | PDF, DOCX, TXT, MD |
| Images per test | 20 | - |

---

## Troubleshooting

### "Connection refused" error
- Ensure MongoDB is running
- Check if backend server started successfully
- Verify `MONGO_URI` in `.env` matches your setup

### "Failed to generate test" error
- Check your `GEMINI_API_KEY` is valid
- Ensure text is at least 200 characters
- Check server logs for detailed error

### Docker issues
```bash
# Check container status
docker-compose ps

# Check container logs
docker-compose logs server

# Restart all containers
docker-compose restart
```

### Port already in use
```bash
# Find process using port (Windows)
netstat -ano | findstr :5000

# Kill process by PID
taskkill /PID <pid> /F
```

---

## Sample Test Data

The application includes 5 sample KIIP Level 2 tests in `additionalContext/tests/`. These are automatically imported on first startup if the database is empty.

---

## Tech Stack

- **Frontend**: React 19, Vite (rolldown-vite), styled-components 6, React Router DOM 7, axios
- **Backend**: Node.js, Express 5, Mongoose 9
- **Database**: MongoDB 7
- **AI**: Google Gemini 2.5 Flash (`@google/generative-ai`)
- **File Processing**: Multer 2, pdf-parse, mammoth
- **Validation**: express-validator, express-rate-limit
- **Auth**: passport, passport-google-oauth20, jsonwebtoken, cookie-parser
- **PDF generation**: pdfkit
- **Testing**: Playwright E2E
- **Deployment**: Docker Compose (mongo + server + client)
- **Design**: Japandi warm minimalism (tokens in `client/src/theme/tokens.js`)

---

## Key Documentation

| File | Purpose |
|------|---------|
| `additionalContext/KIIP_Study_Requirements_Roadmap_Checklist.docx` | Full requirements & roadmap (source of truth) |
| `additionalContext/project_context.md` | Project vision, decisions, functional requirements |
| `IMPLEMENTATION_PLAN.md` | Phased roadmap: Phase 0 (stabilization) + Phases 1–6 |
| `CLAUDE.md` | Claude Code context, coding conventions, workflow rules |
