# KIIP Test Application - Setup & Usage Guide

## Overview

KIIP Study is a desktop-first MERN-stack KIIP exam practice platform with a public, admin-curated test library and per-user progress. It uses AI (Google Gemini) to convert study materials into interactive practice tests.

**Current capabilities:** Test generation from text/documents, Practice and Test modes with 30-minute timer, attempt tracking, image uploads, Docker deployment.

**Planned features:** Google OAuth auth, admin suite, endless mode, additional question types (MCQ multi, short answer, ordering, fill-in-the-blank), PDF exports, Ctrl+P command palette, Ctrl+K shortcuts. See `IMPLEMENTATION_PLAN.md` for the full 6-phase roadmap.

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

### Planned Features (See IMPLEMENTATION_PLAN.md)

- **Endless mode**: Continuous practice drawing from the full library with repetition control
- **Dashboard**: "Continue last session" + "Recent attempts" on home page
- **Ctrl+P command palette**: VSCode-style quick search and open
- **Ctrl+K shortcuts**: Global keyboard shortcuts modal
- **Admin suite**: Admin-only generation, editing, moderation, issue flags
- **PDF exports**: Blank test, answer key, student answers, attempt report
- **Auth**: Google OAuth + JWT for per-user progress across devices
- **Additional question types**: MCQ multi-correct, short answer, ordering, fill-in-the-blank

---

## Environment Variables Reference

### Root `.env` (for Docker Compose)
| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |

### Server `.env`
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/kiip_test_app` |
| `GEMINI_API_KEY` | Google Gemini API key | Required |

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

### Current

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tests` | List all tests with last attempt |
| `GET` | `/api/tests/:id` | Get specific test |
| `POST` | `/api/tests/generate` | Generate test from text |
| `POST` | `/api/tests/generate-from-file` | Generate test from document |
| `POST` | `/api/tests/upload` | Upload single image |
| `POST` | `/api/tests/upload-multiple` | Upload up to 20 images |
| `POST` | `/api/tests/:id/attempt` | Save test attempt |
| `DELETE` | `/api/tests/:id` | Delete test and all attempts |

### Planned (See IMPLEMENTATION_PLAN.md for details)

Auth, sessions, flags, admin, and PDF export endpoints are planned for Phases 4–6.

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
