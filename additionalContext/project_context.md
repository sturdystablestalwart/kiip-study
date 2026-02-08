# Project Context: KIIP Test Application

## Overview
This project is a MERN (MongoDB, Express, React, Node.js) web application designed to help users prepare for the KIIP (Korea Immigration and Integration Program) Level 2 exam. The core feature is an LLM-powered test generator that takes raw text (study materials) and converts it into interactive practice tests.

## User Requirements & Decisions
The following constraints and preferences were established during the initial setup:

1.  **AI Integration:** The app uses an LLM (Large Language Model) to parse and generate tests from unstructured text input.
2.  **Tech Stack:** MERN Stack (MongoDB, Express, React, Node.js).
3.  **Database:** MongoDB for storing tests and user progress.
4.  **Modes:** The app supports both "Practice Mode" (instant feedback) and "Test Mode" (submit at the end).
5.  **Timer:** A countdown timer is included for test simulation (30 minutes default), but it does **not** auto-submit.
6.  **Answer Key:** Answers are hidden until the user explicitly submits the test.
7.  **Editing:** No inline editing of questions is required for the MVP.
8.  **Design Style:** "Japanese Warm Minimalism" - Clean, functional, using off-white (#F9F7F2), wood tones (#D4A373), and muted grey/browns.
9.  **Deployment:** Intended for local network use (e.g., accessing from different devices within a home network).
10. **Media:** Image support is critical for questions that require visual identification.

## Project Structure

```
kiip_test_app/
├── client/                 # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   │   ├── Home.jsx       # Dashboard / Test List
│   │   │   ├── CreateTest.jsx # LLM Input Interface
│   │   │   └── TestTaker.jsx  # Exam Interface
│   │   └── App.jsx         # Main Router & Layout
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
├── server/                 # Backend (Express + Node.js)
│   ├── models/             # Mongoose Schemas
│   │   └── Test.js         # Schema for Test/Question data
│   ├── routes/             # API Routes
│   │   └── tests.js        # Test CRUD & LLM Generation logic
│   ├── index.js            # Server entry point
│   └── package.json        # Backend dependencies
├── additionalContext/      # Context & Documentation (This folder)
└── package.json            # Root configuration for concurrent running
```

## Current Implementation Status

### Backend (`server/`)
*   **Server:** initialized with Express.
*   **Database:** Connected to MongoDB (default: `mongodb://localhost:27017/kiip_test_app`).
*   **API Endpoints:**
    *   `GET /api/tests`: Fetch all tests.
    *   `GET /api/tests/:id`: Fetch a specific test.
    *   `POST /api/tests/generate`: Accepts text, simulates LLM parsing (currently a regex placeholder), and saves a new test.
    *   `POST /api/tests/upload`: Image upload handler.

### Frontend (`client/`)
*   **Framework:** React (Vite).
*   **Styling:** `styled-components` implementing the warm minimalist theme.
*   **Pages:**
    *   **Home:** Displays a grid of available tests.
    *   **Create Test:** A text area to input raw study material for generation.
    *   **Test Taker:** A fully functional exam interface with a 30-minute timer, question navigation, and option selection.

## Next Steps / To-Do List

1.  **LLM Integration (Critical):**
    *   The `server/routes/tests.js` file currently uses a `parseTextWithLLM` function that relies on simple Regex.
    *   **Action:** Replace this with a real call to OpenAI API (`npm install openai`) or Google Gemini API.
    *   **Prompt Engineering:** Design a system prompt that enforces the JSON output format for questions.

2.  **Database Setup:**
    *   Ensure MongoDB is running locally.
    *   Create a `.env` file in `server/` with `MONGO_URI` and `OPENAI_API_KEY`.

3.  **Image Uploads:**
    *   Frontend `CreateTest.jsx` needs a file input to allow uploading images alongside the text.
    *   The backend `upload` route is ready but needs to be integrated into the test creation flow.

4.  **Local Network Access:**
    *   To allow other devices to access the app, update `vite.config.js` to expose the server (`server: { host: true }`) and ensure firewall rules allow traffic on ports 5173 (client) and 5000 (server).

5.  **State Management:**
    *   Currently, the "Submit" button in `TestTaker.jsx` just alerts. It needs to calculate the score and display a results modal.

## Design Palette (Reference)
*   **Background:** `#F9F7F2` (Cream/Off-White)
*   **Card Background:** `#FFFFFF` (White)
*   **Primary Text:** `#4A4A4A` (Dark Grey)
*   **Accent (Highlight):** `#D4A373` (Soft Wood/Sand)
*   **Button/Secondary:** `#8B7E74` (Muted Brown)
