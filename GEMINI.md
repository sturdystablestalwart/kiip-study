# Gemini CLI Context: KIIP Test Application

This document provides instructional context for the KIIP Test Application, a MERN stack project designed to generate and administer practice tests for the Korea Immigration and Integration Program (KIIP) Level 2 exam.

## Project Overview

- **Purpose:** LLM-powered test generator that converts study materials (unstructured text) into interactive practice tests.
- **Tech Stack:**
    - **Frontend:** React (Vite), `styled-components`, `react-router-dom`.
    - **Backend:** Node.js, Express, MongoDB (Mongoose).
    - **AI Integration:** OpenAI/Gemini API (currently implemented as a mock regex parser in `server/routes/tests.js`).
    - **Storage:** Local file system for image uploads (via `multer`).
- **Design Aesthetic:** "Japanese Warm Minimalism" (Cream/Wood/Muted tones).

## Architecture

```
kiip_test_app/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (styled-components)
│   │   ├── pages/          # Route-level components (Home, CreateTest, TestTaker)
│   │   └── App.jsx         # Routing and Global Styles
├── server/                 # Express Backend
│   ├── models/             # Mongoose Schemas (Test.js)
│   ├── routes/             # API Endpoints (tests.js)
│   ├── uploads/            # Local directory for uploaded images
│   └── index.js            # Entry point
```

## Getting Started

### Prerequisites
- Node.js installed.
- MongoDB running locally (default: `mongodb://localhost:27017/kiip_test_app`).

### Installation
Run the following command from the root directory to install dependencies for both client and server:
```bash
npm run install-all
```

### Running the Application
To run both the client and server concurrently:
```bash
npm start
```
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000

## API Endpoints

- `GET /api/tests`: Fetch all available tests.
- `GET /api/tests/:id`: Fetch a specific test by ID.
- `POST /api/tests/generate`: Generate a test from raw text input.
- `POST /api/tests/upload`: Upload images for questions (Multipart form-data).

## Development Conventions

1.  **Styling:** Use `styled-components` in `client/src/App.jsx` and individual components. Follow the palette:
    - Background: `#F9F7F2`
    - Accent: `#D4A373` (Wood)
    - Primary Text: `#4A4A4A`
2.  **State Management:** Local React state for UI; Mongoose for persistent data.
3.  **LLM Integration:** The current parser in `server/routes/tests.js` is a placeholder. Real LLM integration should replace `parseTextWithLLM`.
4.  **Local Network:** To expose the app on a local network, ensure `vite.config.js` has `server: { host: true }`.

## Key Files
- `server/models/Test.js`: Defines the schema for tests, questions, and options.
- `server/routes/tests.js`: Contains the logic for test generation and CRUD operations.
- `client/src/pages/TestTaker.jsx`: Implements the quiz logic, timer, and scoring.
- `client/src/pages/CreateTest.jsx`: Interface for pasting study materials.
