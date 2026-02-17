# Phase 4: Admin Suite & Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google OAuth authentication, admin role guards, admin test editor, and user flag system to transition KIIP Study from open-access to an admin-curated platform.

**Architecture:** Passport.js Google OAuth strategy handles login. JWTs are stored in httpOnly cookies. Two Express middleware layers (`requireAuth`, `requireAdmin`) guard routes. Admin write endpoints move from `/api/tests/` to `/api/admin/tests/`. Frontend AuthContext provides `useAuth()` hook. Flag system lets users report issues; admins moderate via a queue page.

**Tech Stack:** passport-google-oauth20, jsonwebtoken, cookie-parser, Mongoose 9, Express 5, React 19, styled-components 6, axios

**Design doc:** `docs/plans/2026-02-17-phase4-admin-suite-design.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `server/package.json`

**Step 1: Install backend auth packages**

```bash
cd server && npm install passport passport-google-oauth20 jsonwebtoken cookie-parser
```

These provide:
- `passport` + `passport-google-oauth20` — Google OAuth strategy
- `jsonwebtoken` — JWT sign/verify
- `cookie-parser` — Parse cookies from requests

**Step 2: Verify installation**

```bash
cd server && node -e "require('passport'); require('passport-google-oauth20'); require('jsonwebtoken'); require('cookie-parser'); console.log('All auth packages OK')"
```
Expected: `All auth packages OK`

**Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "chore: install auth dependencies (passport, jwt, cookie-parser)"
```

---

## Task 2: User Model

**Files:**
- Create: `server/models/User.js`

**Step 1: Create the User model**

Create `server/models/User.js`:

```js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    googleId: { type: String, required: true, unique: true },
    displayName: { type: String },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
```

**Step 2: Verify the model loads**

```bash
cd server && node -e "const User = require('./models/User'); console.log('User model fields:', Object.keys(User.schema.paths).join(', '))"
```
Expected output should list: `email, googleId, displayName, isAdmin, createdAt, _id, __v`

**Step 3: Commit**

```bash
git add server/models/User.js
git commit -m "feat: add User model with Google OAuth fields"
```

---

## Task 3: Auth Middleware

**Files:**
- Create: `server/middleware/auth.js`

**Step 1: Create the auth middleware file**

Create `server/middleware/auth.js`:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.jwt;
        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
```

**Step 2: Verify middleware loads**

```bash
cd server && node -e "const { requireAuth, requireAdmin } = require('./middleware/auth'); console.log('Middleware OK:', typeof requireAuth, typeof requireAdmin)"
```
Expected: `Middleware OK: function function`

**Step 3: Commit**

```bash
git add server/middleware/auth.js
git commit -m "feat: add requireAuth and requireAdmin middleware"
```

---

## Task 4: Passport Strategy & Auth Routes

**Files:**
- Create: `server/routes/auth.js`
- Modify: `server/index.js:1-17,45-47`

**Step 1: Create the auth routes file**

Create `server/routes/auth.js`:

```js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/'
};

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('No email found in Google profile'));
            }

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                // Check if this email should be admin
                const isAdmin = email === process.env.ADMIN_EMAIL;

                user = await User.create({
                    googleId: profile.id,
                    email,
                    displayName: profile.displayName || email.split('@')[0],
                    isAdmin
                });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// No session serialization needed — we use JWT cookies, not sessions
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// GET /api/auth/google/start — Initiate Google OAuth
router.get('/google/start',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// GET /api/auth/google/callback — Google redirects here
router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
        // Sign JWT
        const token = jwt.sign(
            { userId: req.user._id, isAdmin: req.user.isAdmin },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set httpOnly cookie
        res.cookie('jwt', token, COOKIE_OPTIONS);

        // Redirect to frontend
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        res.redirect(clientUrl);
    }
);

// GET /api/auth/me — Return current user
router.get('/me', requireAuth, (req, res) => {
    res.json({
        _id: req.user._id,
        email: req.user.email,
        displayName: req.user.displayName,
        isAdmin: req.user.isAdmin
    });
});

// POST /api/auth/logout — Clear JWT cookie
router.post('/logout', (req, res) => {
    res.clearCookie('jwt', { path: '/' });
    res.json({ message: 'Logged out' });
});

module.exports = router;
```

**Step 2: Update `server/index.js` to mount auth routes and add cookie-parser**

Add imports at the top of `server/index.js` (after line 7):

```js
const cookieParser = require('cookie-parser');
const passport = require('passport');
```

Update the CORS middleware (replace line 15) to allow credentials:

```js
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
```

Add cookie-parser after `express.json()` (after line 16):

```js
app.use(cookieParser());
app.use(passport.initialize());
```

Mount auth routes (after line 47):

```js
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

**Step 3: Add auth env vars to `.env.example`**

Append to the root `.env.example`:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret-change-in-production
ADMIN_EMAIL=admin@example.com
CLIENT_URL=http://localhost:5173
GOOGLE_CALLBACK_URL=/api/auth/google/callback
```

**Step 4: Verify server starts without errors**

```bash
cd server && node -e "
process.env.GEMINI_API_KEY='test';
process.env.GOOGLE_CLIENT_ID='test';
process.env.GOOGLE_CLIENT_SECRET='test';
const cookieParser = require('cookie-parser');
const passport = require('passport');
require('./routes/auth');
console.log('Auth routes loaded OK');
"
```
Expected: `Auth routes loaded OK`

**Step 5: Commit**

```bash
git add server/routes/auth.js server/index.js .env.example
git commit -m "feat: add Google OAuth strategy and auth routes"
```

---

## Task 5: Frontend AuthContext & Axios Config

**Files:**
- Create: `client/src/context/AuthContext.jsx`
- Create: `client/src/utils/api.js`

**Step 1: Create the axios instance with credentials**

Create `client/src/utils/api.js`:

```js
import axios from 'axios';
import API_BASE_URL from '../config/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
});

export default api;
```

This creates a shared axios instance that automatically sends the httpOnly JWT cookie with every request. All API calls should use `api.get(...)` instead of `axios.get(${API_BASE_URL}/...)`.

**Step 2: Create the AuthContext**

Create `client/src/context/AuthContext.jsx`:

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/api/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (err) {
            // Ignore — clear client state regardless
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
```

**Step 3: Verify files exist**

```bash
ls client/src/context/AuthContext.jsx client/src/utils/api.js
```
Expected: Both files listed.

**Step 4: Commit**

```bash
git add client/src/context/AuthContext.jsx client/src/utils/api.js
git commit -m "feat: add AuthContext provider and shared axios instance"
```

---

## Task 6: Nav Auth UI & AuthProvider Wiring

**Files:**
- Modify: `client/src/App.jsx:1-12,99-115,138-155`

**Step 1: Wire AuthProvider into App**

In `client/src/App.jsx`, add imports:

```js
import { AuthProvider, useAuth } from './context/AuthContext';
```

Wrap the entire `<ThemeProvider>` content with `<AuthProvider>`:

```jsx
// In App() return, wrap Router with AuthProvider:
<ThemeProvider theme={tokens}>
    <GlobalStyles />
    <AuthProvider>
        <Router>
            ...
        </Router>
    </AuthProvider>
</ThemeProvider>
```

**Step 2: Add auth UI to Navigation component**

Update the `Navigation` component (currently lines 99-115) to show auth state:

Add these styled components for auth UI:

```jsx
const AuthSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const SignInButton = styled.a`
  display: inline-flex;
  align-items: center;
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: #fff;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: 550;
  text-decoration: none;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { opacity: 0.85; }
`;

const UserName = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const SignOutButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[2]}px;

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`;
```

Update the Navigation component to use auth:

```jsx
function Navigation({ onSearchClick }) {
    const location = useLocation();
    const { user, loading, logout } = useAuth();

    return (
        <Nav>
            <Logo to="/">KIIP Study</Logo>
            <NavSearchTrigger onClick={onSearchClick} aria-label="Search tests">
                Search tests...
                <SearchHint>Ctrl+P</SearchHint>
            </NavSearchTrigger>
            <NavLinks>
                <NavLink to="/" active={location.pathname === '/' ? 1 : 0}>Tests</NavLink>
                {user?.isAdmin && (
                    <NavLink to="/create" active={location.pathname === '/create' ? 1 : 0}>New Test</NavLink>
                )}
                {user?.isAdmin && (
                    <NavLink to="/admin/flags" active={location.pathname.startsWith('/admin/flags') ? 1 : 0}>Flags</NavLink>
                )}
            </NavLinks>
            <AuthSection>
                {loading ? null : user ? (
                    <>
                        <UserName>{user.displayName}</UserName>
                        <SignOutButton onClick={logout}>Sign out</SignOutButton>
                    </>
                ) : (
                    <SignInButton href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google/start`}>
                        Sign in
                    </SignInButton>
                )}
            </AuthSection>
        </Nav>
    );
}
```

Key changes:
- "New Test" link only shows for admins
- "Flags" link shows for admins
- Auth section shows sign in/out based on state
- Sign in links directly to the Google OAuth start endpoint

**Step 3: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add auth UI to nav with sign in/out and admin links"
```

---

## Task 7: Admin Routes — Move Generate/Upload/Delete

**Files:**
- Create: `server/routes/admin.js`
- Modify: `server/routes/tests.js:377-561`
- Modify: `server/index.js:45-49`

**Step 1: Create `server/routes/admin.js`**

This file takes the generate, upload, and delete handlers from `tests.js` and puts them behind `requireAdmin`:

```js
const express = require('express');
const router = express.Router();
const Test = require('../models/Test');
const Attempt = require('../models/Attempt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseTextWithLLM } = require('./tests');

// All admin routes require auth + admin
router.use(requireAuth, requireAdmin);

// --- Rate Limiting (10 requests per minute) ---
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: 'Too many requests. Please wait a minute before trying again.' },
    standardHeaders: true,
    legacyHeaders: false
});

// --- Multer Setup for Documents ---
const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/documents');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});

const documentFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, DOCX, TXT, and MD files are allowed'), false);
    }
};

const documentUpload = multer({
    storage: documentStorage,
    fileFilter: documentFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

// --- Multer Setup for Images ---
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/images');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

const imageFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'image/webp', 'image/bmp', 'image/tiff'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, GIF, WebP, BMP, and TIFF images are allowed'), false);
    }
};

const imageUpload = multer({
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 20 }
});

// --- Validation ---
const validateTextGeneration = [
    body('text')
        .trim()
        .isLength({ min: 200 })
        .withMessage('Text must be at least 200 characters long')
        .isLength({ max: 50000 })
        .withMessage('Text must not exceed 50,000 characters')
];

// ============================================
// ADMIN ROUTES (all require requireAuth + requireAdmin via router.use)
// ============================================

// POST /api/admin/tests/generate — Generate test from text
router.post('/tests/generate', apiLimiter, validateTextGeneration, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array().map(e => e.msg).join('. ')
        });
    }

    try {
        const { text } = req.body;
        const data = await parseTextWithLLM(text);

        if (!data.questions || data.questions.length === 0) {
            return res.status(400).json({
                message: 'AI could not generate any questions from the provided text. Please provide more detailed content.'
            });
        }

        const newTest = new Test({
            title: data.title || 'Generated Test',
            questions: data.questions,
            category: 'Text Input'
        });

        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (err) {
        console.error("Text Generation Error:", err);
        res.status(400).json({ message: err.message });
    }
});

// POST /api/admin/tests/upload — Upload single image
router.post('/tests/upload', imageUpload.single('image'), (req, res) => {
    if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
    }
    res.json({
        imageUrl: '/uploads/images/' + req.file.filename,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
    });
});

// POST /api/admin/tests/upload-multiple — Upload up to 20 images
router.post('/tests/upload-multiple', imageUpload.array('images', 20), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No image files uploaded' });
    }
    const uploadedFiles = req.files.map(file => ({
        imageUrl: '/uploads/images/' + file.filename,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
    }));
    res.json({ images: uploadedFiles });
});

// POST /api/admin/tests/generate-from-file — Generate from uploaded document
router.post('/tests/generate-from-file', apiLimiter, documentUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No document file uploaded' });
    }

    let text = '';
    const filePath = req.file.path;

    try {
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            text = data.text;
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
        } else {
            text = fs.readFileSync(filePath, 'utf-8');
        }

        if (text.trim().length < 200) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'Document contains less than 200 characters of text. Please upload a document with more content.'
            });
        }

        if (text.length > 50000) {
            text = text.substring(0, 50000);
        }

        const data = await parseTextWithLLM(text);

        if (!data.questions || data.questions.length === 0) {
            fs.unlinkSync(filePath);
            return res.status(400).json({
                message: 'AI could not generate any questions from the document. Please try a different document.'
            });
        }

        const newTest = new Test({
            title: data.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
            questions: data.questions,
            category: 'File Upload'
        });
        const savedTest = await newTest.save();
        fs.unlinkSync(filePath);
        res.status(201).json(savedTest);
    } catch (err) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error("File Generation Error:", err);
        res.status(400).json({ message: 'Failed to process document: ' + err.message });
    }
});

// POST /api/admin/tests/import — Import test from JSON
router.post('/tests/import', async (req, res) => {
    try {
        const { title, category, description, level, unit, questions } = req.body;

        if (!title || !questions || !questions.length) {
            return res.status(400).json({ message: 'Title and at least one question are required' });
        }

        const newTest = new Test({
            title,
            category: category || 'Import',
            description,
            level,
            unit,
            questions
        });

        const savedTest = await newTest.save();
        res.status(201).json(savedTest);
    } catch (err) {
        res.status(400).json({ message: 'Failed to import test: ' + err.message });
    }
});

// PATCH /api/admin/tests/:id — Update test
router.patch('/tests/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const { title, category, description, level, unit, questions } = req.body;
        if (title !== undefined) test.title = title;
        if (category !== undefined) test.category = category;
        if (description !== undefined) test.description = description;
        if (level !== undefined) test.level = level;
        if (unit !== undefined) test.unit = unit;
        if (questions !== undefined) test.questions = questions;

        const savedTest = await test.save();
        res.json(savedTest);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update test: ' + err.message });
    }
});

// DELETE /api/admin/tests/:id — Delete test and attempts
router.delete('/tests/:id', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        await Attempt.deleteMany({ testId: req.params.id });
        await Test.findByIdAndDelete(req.params.id);

        res.json({ message: 'Test deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete test: ' + err.message });
    }
});

// Error handling middleware for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files. Maximum is 20 images.' });
        }
        return res.status(400).json({ message: 'File upload error: ' + err.message });
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
});

module.exports = router;
```

**Step 2: Remove moved routes from `server/routes/tests.js`**

Remove these sections from `tests.js` (they now live in `admin.js`):
- Lines 85-176: All multer setup (documentStorage, documentFilter, documentUpload, imageStorage, imageFilter, imageUpload)
- Lines 168-176: validateTextGeneration
- Lines 377-411: `POST /generate`
- Lines 413-429: `POST /upload`
- Lines 431-445: `POST /upload-multiple`
- Lines 447-509: `POST /generate-from-file`
- Lines 543-561: `DELETE /:id`
- Lines 563-577: Multer error middleware

Also remove these now-unused imports from the top of `tests.js`:
- `multer` (line 6)
- `path` (line 7)
- `fs` (line 8)
- `body, validationResult` from `express-validator` (line 9)
- `rateLimit` from `express-rate-limit` (line 10)
- `GoogleGenerativeAI` (line 11)
- `pdf` (line 12)
- `mammoth` (line 13)

And remove:
- Lines 16-23: `apiLimiter` rate limiter setup
- Lines 25-83: `genAI` + `parseTextWithLLM` function

**Important:** Keep `parseTextWithLLM` exported from `tests.js` but move it to a standalone utility so both `admin.js` and `autoImporter.js` can use it. Create `server/utils/llm.js`:

```js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const parseTextWithLLM = async (text) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
        You are an expert KIIP (Korea Immigration and Integration Program) Level 2 instructor.
        Your task is to parse the following text and convert it into a structured practice test.
        The text might be raw study material or an existing mock test.

        REQUIREMENTS:
        1. Generate exactly 20 questions if possible.
        2. Questions must be multiple-choice with 4 options each.
        3. Include a helpful explanation for each answer IN ENGLISH.
        4. If the text mentions images like "[Image 1]" or "q1.jpg", include the filename in the "image" field.
        5. Point spread: Vocabulary/Grammar (Questions 1-10) are usually 4 points each, Reading (11-20) are 6 points each (or adjust to fit KIIP standard total of 100).
        6. The output MUST be a valid JSON object matching this structure:
        {
          "title": "A descriptive title for the test",
          "questions": [
            {
              "text": "The question text (in Korean)",
              "options": [
                { "text": "Option 1", "isCorrect": false },
                { "text": "Option 2", "isCorrect": true },
                { "text": "Option 3", "isCorrect": false },
                { "text": "Option 4", "isCorrect": false }
              ],
              "explanation": "Why the correct answer is right (IN ENGLISH)",
              "type": "mcq-single",
              "image": "optional_filename.jpg"
            }
          ]
        }

        TEXT TO PARSE:
        ${text}

        Respond ONLY with the JSON object.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);

        if (!parsed.questions || parsed.questions.length === 0) {
            throw new Error('AI generated no valid questions. Please provide more content.');
        }

        return parsed;
    } catch (err) {
        console.error("LLM Parsing Error:", err);
        throw new Error("Failed to parse text with AI: " + err.message);
    }
};

module.exports = { parseTextWithLLM };
```

Then update `admin.js` to import from `../utils/llm` instead of `./tests`:

```js
const { parseTextWithLLM } = require('../utils/llm');
```

Update `server/routes/tests.js` to keep exporting `parseTextWithLLM` for backward compat with `autoImporter`:

```js
const { parseTextWithLLM } = require('../utils/llm');
// ... (re-export at the bottom)
module.exports = { router, parseTextWithLLM };
```

Update `server/utils/autoImporter.js` — it receives `parseTextWithLLM` as a parameter from `index.js`, so no changes needed there. But verify the import chain in `index.js` still works:

```js
// In index.js, line 40 — this still works because tests.js re-exports parseTextWithLLM
const { parseTextWithLLM } = require('./routes/tests');
```

**Step 3: Mount admin routes in `server/index.js`**

Add after the auth routes mount:

```js
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);
```

**Step 4: Verify the cleaned-up tests.js still works**

After editing, `server/routes/tests.js` should only contain:
- Imports: `express`, `mongoose`, `Test`, `Attempt`, `scoreQuestion`, `parseTextWithLLM` (from `../utils/llm`)
- Routes: `GET /`, `GET /recent-attempts`, `GET /endless`, `POST /endless/attempt`, `GET /:id`, `POST /:id/attempt`
- Export: `{ router, parseTextWithLLM }`

```bash
cd server && node -e "
process.env.GEMINI_API_KEY='test';
process.env.GOOGLE_CLIENT_ID='test';
process.env.GOOGLE_CLIENT_SECRET='test';
const { router } = require('./routes/tests');
const admin = require('./routes/admin');
console.log('Routes OK');
"
```
Expected: `Routes OK`

**Step 5: Commit**

```bash
git add server/utils/llm.js server/routes/admin.js server/routes/tests.js server/index.js
git commit -m "feat: move generate/upload/delete routes to admin with auth guards"
```

---

## Task 8: Update Frontend API Calls

**Files:**
- Modify: `client/src/pages/CreateTest.jsx:1-5,301,354,362`
- Modify: `client/src/pages/Home.jsx:1-6,462,489,515`
- Modify: `client/src/pages/TestTaker.jsx:1-7,394,537-545`
- Modify: `client/src/pages/EndlessMode.jsx` (API calls)
- Modify: `client/src/components/CommandPalette.jsx:1-5`

**Step 1: Update CreateTest.jsx to use shared api instance and admin URLs**

Replace `import axios from 'axios'` and `import API_BASE_URL from '../config/api'` with:

```js
import api from '../utils/api';
```

Update API calls:
- Line 301: `axios.post(\`${API_BASE_URL}/api/tests/upload\`, ...)` → `api.post('/api/admin/tests/upload', ...)`
- Line 354: `axios.post(\`${API_BASE_URL}/api/tests/generate-from-file\`, ...)` → `api.post('/api/admin/tests/generate-from-file', ...)`
- Line 362: `axios.post(\`${API_BASE_URL}/api/tests/generate\`, ...)` → `api.post('/api/admin/tests/generate', ...)`

Remove `${API_BASE_URL}` prefix from all calls — the `api` instance has `baseURL` set.

**Step 2: Update Home.jsx to use shared api instance**

Replace `import axios from 'axios'` and `import API_BASE_URL from '../config/api'` with:

```js
import api from '../utils/api';
```

Update API calls:
- Line 462: `axios.get(\`${API_BASE_URL}/api/tests?...\`)` → `api.get('/api/tests?...')`
- Line 489: `axios.get(\`${API_BASE_URL}/api/tests/recent-attempts?...\`)` → `api.get('/api/tests/recent-attempts?...')`
- Line 515: `axios.delete(\`${API_BASE_URL}/api/tests/${deleteModal.testId}\`)` → `api.delete(\`/api/admin/tests/${deleteModal.testId}\`)`

**Step 3: Update TestTaker.jsx to use shared api instance**

Replace `import axios from 'axios'` and `import API_BASE_URL from '../config/api'` with:

```js
import api from '../utils/api';
```

Update API calls:
- Line 394: `axios.get(\`${API_BASE_URL}/api/tests/${id}\`)` → `api.get(\`/api/tests/${id}\`)`
- Lines 537-545: `axios.post(\`${API_BASE_URL}/api/tests/${id}/attempt\`, ...)` → `api.post(\`/api/tests/${id}/attempt\`, ...)`

**Step 4: Update EndlessMode.jsx to use shared api instance**

Same pattern — replace `axios` + `API_BASE_URL` with `api` from `../utils/api`. Update all API calls to use relative paths.

**Step 5: Update CommandPalette.jsx to use shared api instance**

Replace `import axios from 'axios'` and `import API_BASE_URL from '../config/api'` with:

```js
import api from '../utils/api';
```

Update the search call to use `api.get('/api/tests?...')`.

**Step 6: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add client/src/pages/CreateTest.jsx client/src/pages/Home.jsx client/src/pages/TestTaker.jsx client/src/pages/EndlessMode.jsx client/src/components/CommandPalette.jsx
git commit -m "feat: update all frontend API calls to use shared axios instance and admin URLs"
```

---

## Task 9: Gate Admin Features in Home & App

**Files:**
- Modify: `client/src/pages/Home.jsx:506-528,540-543,614-633`
- Modify: `client/src/App.jsx` (routes)

**Step 1: Gate delete and create buttons in Home.jsx**

Import `useAuth`:

```js
import { useAuth } from '../context/AuthContext';
```

In the Home component function, add:

```js
const { user } = useAuth();
const isAdmin = user?.isAdmin;
```

Wrap the `CreateButton` (line 542) with admin check:

```jsx
{isAdmin && <CreateButton to="/create">+ New Test</CreateButton>}
```

Wrap the `DeleteButton` (lines 628-633) with admin check:

```jsx
{isAdmin && (
    <DeleteButton
        onClick={(e) => handleDeleteClick(e, test._id, test.title)}
        aria-label={`Delete ${test.title}`}
    >
        &times;
    </DeleteButton>
)}
```

Also wrap the empty-state "Create a Test" link:

```jsx
{!levelFilter && !unitFilter && isAdmin && (
    <CreateButton to="/create">Create a Test</CreateButton>
)}
```

**Step 2: Add an "Edit" button on test cards for admins**

Add a new styled component:

```jsx
const EditButton = styled(Link)`
  position: absolute;
  top: ${({ theme }) => theme.layout.space[3]}px;
  right: ${({ theme }) => theme.layout.space[8]}px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: 14px;
  text-decoration: none;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.selection.bg};
  }
`;
```

Add in the Card JSX (before DeleteButton):

```jsx
{isAdmin && (
    <EditButton
        to={`/admin/tests/${test._id}/edit`}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Edit ${test.title}`}
    >
        &#9998;
    </EditButton>
)}
```

**Step 3: Add admin routes in App.jsx**

Import the new pages (they'll be created in later tasks, use lazy loading placeholder for now):

```jsx
import AdminTestEditor from './pages/AdminTestEditor';
import AdminFlags from './pages/AdminFlags';
```

Add routes inside `<Routes>`:

```jsx
<Route path="/admin/tests/:id/edit" element={<AdminTestEditor />} />
<Route path="/admin/flags" element={<AdminFlags />} />
```

For now, create placeholder files so the build doesn't break.

Create `client/src/pages/AdminTestEditor.jsx`:

```jsx
import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

function AdminTestEditor() {
    return <Container>Test Editor — coming soon</Container>;
}

export default AdminTestEditor;
```

Create `client/src/pages/AdminFlags.jsx`:

```jsx
import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.muted};
`;

function AdminFlags() {
    return <Container>Flags Queue — coming soon</Container>;
}

export default AdminFlags;
```

**Step 4: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add client/src/pages/Home.jsx client/src/App.jsx client/src/pages/AdminTestEditor.jsx client/src/pages/AdminFlags.jsx
git commit -m "feat: gate admin features in UI and add admin route placeholders"
```

---

## Task 10: Add userId to Attempts & Guard User Routes

**Files:**
- Modify: `server/models/Attempt.js:13-26`
- Modify: `server/routes/tests.js` (add requireAuth to user routes)

**Step 1: Add userId field to Attempt model**

In `server/models/Attempt.js`, add after `testId` (line 14):

```js
userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
```

**Step 2: Add requireAuth to user-facing routes in tests.js**

Import middleware at the top of `server/routes/tests.js`:

```js
const { requireAuth } = require('../middleware/auth');
```

Apply `requireAuth` to these routes:
- `POST /:id/attempt` — add `requireAuth` middleware and set `userId: req.user._id` on the attempt
- `POST /endless/attempt` — add `requireAuth` and set `userId: req.user._id`
- `GET /recent-attempts` — add `requireAuth` and filter by `userId: req.user._id`

Update `POST /:id/attempt` (currently around line 512):

```js
router.post('/:id/attempt', requireAuth, async (req, res) => {
    // ... existing code ...
    const attempt = new Attempt({
        testId: req.params.id,
        userId: req.user._id,  // <-- ADD THIS
        score: serverScore,
        // ... rest stays the same
    });
    // ...
});
```

Update `POST /endless/attempt`:

```js
router.post('/endless/attempt', requireAuth, async (req, res) => {
    // ... existing code ...
    const attempt = new Attempt({
        testId: null,
        userId: req.user._id,  // <-- ADD THIS
        score,
        // ... rest stays the same
    });
    // ...
});
```

Update `GET /recent-attempts`:

```js
router.get('/recent-attempts', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const attempts = await Attempt.find({ userId: req.user._id })  // <-- FILTER BY USER
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        // ... rest stays the same
    }
});
```

Also add `requireAuth` to `GET /endless` so only logged-in users can access:

```js
router.get('/endless', requireAuth, async (req, res) => {
    // ... existing code unchanged
});
```

**Step 3: Verify server loads**

```bash
cd server && node -e "
process.env.GEMINI_API_KEY='test';
process.env.GOOGLE_CLIENT_ID='test';
process.env.GOOGLE_CLIENT_SECRET='test';
const { router } = require('./routes/tests');
console.log('Tests routes OK');
"
```
Expected: `Tests routes OK`

**Step 4: Commit**

```bash
git add server/models/Attempt.js server/routes/tests.js
git commit -m "feat: add userId to attempts and requireAuth on user routes"
```

---

## Task 11: Flag Model & API Routes

**Files:**
- Create: `server/models/Flag.js`
- Modify: `server/routes/admin.js` (add flag admin routes)
- Create: `server/routes/flags.js` (user flag submission)
- Modify: `server/index.js` (mount flags routes)

**Step 1: Create Flag model**

Create `server/models/Flag.js`:

```js
const mongoose = require('mongoose');

const FlagSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    questionIndex: { type: Number },
    reason: {
        type: String,
        required: true,
        enum: ['incorrect-answer', 'unclear-question', 'typo', 'other']
    },
    note: { type: String, maxlength: 500 },
    status: {
        type: String,
        enum: ['open', 'resolved', 'dismissed'],
        default: 'open'
    },
    resolution: { type: String }
}, { timestamps: true });

// One flag per user per test per question (upsert pattern)
FlagSchema.index({ userId: 1, testId: 1, questionIndex: 1 }, { unique: true });

// Query flags by status (for admin queue)
FlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Flag', FlagSchema);
```

**Step 2: Create user flag routes**

Create `server/routes/flags.js`:

```js
const express = require('express');
const router = express.Router();
const Flag = require('../models/Flag');
const { requireAuth } = require('../middleware/auth');

// POST /api/flags — Submit or update a flag
router.post('/', requireAuth, async (req, res) => {
    try {
        const { testId, questionIndex, reason, note } = req.body;

        if (!testId || !reason) {
            return res.status(400).json({ message: 'testId and reason are required' });
        }

        const validReasons = ['incorrect-answer', 'unclear-question', 'typo', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ message: 'Invalid reason' });
        }

        // Upsert: one flag per user per question
        const flag = await Flag.findOneAndUpdate(
            {
                userId: req.user._id,
                testId,
                questionIndex: questionIndex ?? null
            },
            {
                userId: req.user._id,
                testId,
                questionIndex: questionIndex ?? null,
                reason,
                note: note?.slice(0, 500) || '',
                status: 'open'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json(flag);
    } catch (err) {
        res.status(400).json({ message: 'Failed to submit flag: ' + err.message });
    }
});

module.exports = router;
```

**Step 3: Add admin flag routes to `server/routes/admin.js`**

Add import at the top of `admin.js`:

```js
const Flag = require('../models/Flag');
```

Add these routes at the bottom (before the error handler):

```js
// GET /api/admin/flags — List flags (cursor-paginated, filterable by status)
router.get('/flags', async (req, res) => {
    try {
        const { status, cursor, limit: rawLimit } = req.query;
        const limit = Math.min(Math.max(parseInt(rawLimit) || 20, 1), 50);

        const match = {};
        if (status) match.status = status;
        if (cursor) {
            const mongoose = require('mongoose');
            if (mongoose.Types.ObjectId.isValid(cursor)) {
                match._id = { $lt: new mongoose.Types.ObjectId(cursor) };
            }
        }

        const flags = await Flag.find(match)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate('userId', 'email displayName')
            .populate('testId', 'title')
            .lean();

        const hasMore = flags.length > limit;
        const results = hasMore ? flags.slice(0, limit) : flags;
        const nextCursor = hasMore ? results[results.length - 1]._id : null;

        // Count open flags for badge
        const openCount = await Flag.countDocuments({ status: 'open' });

        res.json({ flags: results, nextCursor, openCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch flags: ' + err.message });
    }
});

// GET /api/admin/flags/count — Get open flags count (for nav badge)
router.get('/flags/count', async (req, res) => {
    try {
        const openCount = await Flag.countDocuments({ status: 'open' });
        res.json({ openCount });
    } catch (err) {
        res.status(500).json({ message: 'Failed to count flags: ' + err.message });
    }
});

// PATCH /api/admin/flags/:id — Resolve or dismiss a flag
router.patch('/flags/:id', async (req, res) => {
    try {
        const { status, resolution } = req.body;
        if (!['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ message: 'Status must be "resolved" or "dismissed"' });
        }

        const flag = await Flag.findByIdAndUpdate(
            req.params.id,
            { status, resolution: resolution || '' },
            { new: true }
        );

        if (!flag) {
            return res.status(404).json({ message: 'Flag not found' });
        }

        res.json(flag);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update flag: ' + err.message });
    }
});
```

**Step 4: Mount flags routes in `server/index.js`**

Add after the admin routes mount:

```js
const flagRoutes = require('./routes/flags');
app.use('/api/flags', flagRoutes);
```

**Step 5: Verify**

```bash
cd server && node -e "
process.env.GEMINI_API_KEY='test';
process.env.GOOGLE_CLIENT_ID='test';
process.env.GOOGLE_CLIENT_SECRET='test';
require('./models/Flag');
require('./routes/flags');
console.log('Flags OK');
"
```
Expected: `Flags OK`

**Step 6: Commit**

```bash
git add server/models/Flag.js server/routes/flags.js server/routes/admin.js server/index.js
git commit -m "feat: add Flag model and flag API routes (user submit + admin queue)"
```

---

## Task 12: Flag Submission UI in TestTaker

**Files:**
- Modify: `client/src/pages/TestTaker.jsx`

**Step 1: Add flag button and modal to TestTaker**

Import `useAuth`:

```js
import { useAuth } from '../context/AuthContext';
```

Import `api`:

```js
import api from '../utils/api';
```

Add state for flag modal:

```js
const { user } = useAuth();
const [showFlagModal, setShowFlagModal] = useState(false);
const [flagReason, setFlagReason] = useState('');
const [flagNote, setFlagNote] = useState('');
const [flagSubmitting, setFlagSubmitting] = useState(false);
const [flagSuccess, setFlagSuccess] = useState(false);
```

Add styled components for the flag button and modal fields:

```jsx
const FlagButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.state.warning};
    border-color: ${({ theme }) => theme.colors.state.warning};
  }
`;

const FlagSelect = styled.select`
  width: 100%;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const FlagTextarea = styled.textarea`
  width: 100%;
  min-height: 80px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const FlagSuccessMsg = styled.p`
  color: ${({ theme }) => theme.colors.state.success};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  text-align: center;
  margin: ${({ theme }) => theme.layout.space[4]}px 0;
`;
```

Add flag submission handler:

```js
const handleFlagSubmit = async () => {
    if (!flagReason) return;
    setFlagSubmitting(true);
    try {
        await api.post('/api/flags', {
            testId: id,
            questionIndex: currentQ,
            reason: flagReason,
            note: flagNote
        });
        setFlagSuccess(true);
        setTimeout(() => {
            setShowFlagModal(false);
            setFlagSuccess(false);
            setFlagReason('');
            setFlagNote('');
        }, 1500);
    } catch (err) {
        console.error('Flag submit error:', err);
    } finally {
        setFlagSubmitting(false);
    }
};
```

Add FlagButton in the question area (near the question text, after QuestionRenderer):

```jsx
{user && (
    <FlagButton onClick={() => setShowFlagModal(true)}>
        &#9873; Report issue
    </FlagButton>
)}
```

Add flag modal (reuse existing ModalOverlay/ModalCard pattern):

```jsx
{showFlagModal && (
    <ModalOverlay onClick={() => setShowFlagModal(false)}>
        <ModalCard onClick={e => e.stopPropagation()}>
            <h3>Report an issue</h3>
            {flagSuccess ? (
                <FlagSuccessMsg>Thanks for your feedback!</FlagSuccessMsg>
            ) : (
                <>
                    <FlagSelect
                        value={flagReason}
                        onChange={e => setFlagReason(e.target.value)}
                    >
                        <option value="">Select a reason...</option>
                        <option value="incorrect-answer">Incorrect answer</option>
                        <option value="unclear-question">Unclear question</option>
                        <option value="typo">Typo</option>
                        <option value="other">Other</option>
                    </FlagSelect>
                    <FlagTextarea
                        placeholder="Additional details (optional)"
                        value={flagNote}
                        onChange={e => setFlagNote(e.target.value)}
                        maxLength={500}
                    />
                    <ModalActions>
                        <ModalBtnSecondary onClick={() => setShowFlagModal(false)}>
                            Cancel
                        </ModalBtnSecondary>
                        <ModalBtnPrimary
                            onClick={handleFlagSubmit}
                            disabled={!flagReason || flagSubmitting}
                        >
                            {flagSubmitting ? 'Submitting...' : 'Submit'}
                        </ModalBtnPrimary>
                    </ModalActions>
                </>
            )}
        </ModalCard>
    </ModalOverlay>
)}
```

**Step 2: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/pages/TestTaker.jsx
git commit -m "feat: add flag submission button and modal to TestTaker"
```

---

## Task 13: Admin Flags Page

**Files:**
- Modify: `client/src/pages/AdminFlags.jsx` (replace placeholder)

**Step 1: Implement the full AdminFlags page**

Replace `client/src/pages/AdminFlags.jsx` with:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const FilterTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const Tab = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ $active, theme }) => $active ? theme.colors.accent.indigo : theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ $active, theme }) => $active ? theme.colors.accent.indigo : 'transparent'};
  color: ${({ $active, theme }) => $active ? '#fff' : theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

const FlagList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const FlagCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
`;

const FlagHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const FlagInfo = styled.div`
  flex: 1;
`;

const FlagTest = styled(Link)`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: 550;
  color: ${({ theme }) => theme.colors.accent.indigo};
  text-decoration: none;

  &:hover { text-decoration: underline; }
`;

const FlagMeta = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: ${({ theme }) => theme.layout.space[1]}px 0;
`;

const FlagReason = styled.span`
  display: inline-block;
  padding: 2px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
`;

const FlagNote = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};
  margin: ${({ theme }) => theme.layout.space[3]}px 0;
  padding: ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
`;

const FlagActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  align-items: center;
`;

const ActionBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    color: ${({ theme }) => theme.colors.accent.indigo};
  }

  &:disabled { opacity: 0.5; cursor: default; }
`;

const ResolveBtn = styled(ActionBtn)`
  background: ${({ theme }) => theme.colors.state.success};
  color: #fff;
  border-color: ${({ theme }) => theme.colors.state.success};

  &:hover { opacity: 0.85; border-color: ${({ theme }) => theme.colors.state.success}; color: #fff; }
`;

const ResolutionInput = styled.input`
  flex: 1;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const LoadMoreButton = styled.button`
  display: block;
  margin: ${({ theme }) => theme.layout.space[6]}px auto;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  cursor: pointer;

  &:hover { border-color: ${({ theme }) => theme.colors.focus.ring}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.layout.space[8]}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const REASON_LABELS = {
    'incorrect-answer': 'Incorrect answer',
    'unclear-question': 'Unclear question',
    'typo': 'Typo',
    'other': 'Other'
};

function AdminFlags() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('open');
    const [nextCursor, setNextCursor] = useState(null);
    const [resolutions, setResolutions] = useState({});
    const [updating, setUpdating] = useState({});

    const fetchFlags = useCallback(async (cursor = null, append = false) => {
        try {
            setLoading(!append);
            const params = new URLSearchParams({ status: statusFilter, limit: '20' });
            if (cursor) params.set('cursor', cursor);
            const res = await api.get(`/api/admin/flags?${params}`);
            setFlags(prev => append ? [...prev, ...res.data.flags] : res.data.flags);
            setNextCursor(res.data.nextCursor);
        } catch (err) {
            console.error('Failed to fetch flags:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        if (!authLoading && !user?.isAdmin) {
            navigate('/');
            return;
        }
        if (!authLoading && user?.isAdmin) {
            fetchFlags();
        }
    }, [authLoading, user, fetchFlags, navigate]);

    const handleUpdateFlag = async (flagId, status) => {
        setUpdating(prev => ({ ...prev, [flagId]: true }));
        try {
            await api.patch(`/api/admin/flags/${flagId}`, {
                status,
                resolution: resolutions[flagId] || ''
            });
            setFlags(prev => prev.filter(f => f._id !== flagId));
        } catch (err) {
            console.error('Failed to update flag:', err);
        } finally {
            setUpdating(prev => ({ ...prev, [flagId]: false }));
        }
    };

    if (authLoading) return null;

    return (
        <div>
            <PageHeader>
                <Title>Flags</Title>
            </PageHeader>

            <FilterTabs>
                {['open', 'resolved', 'dismissed'].map(s => (
                    <Tab
                        key={s}
                        $active={statusFilter === s}
                        onClick={() => setStatusFilter(s)}
                    >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Tab>
                ))}
            </FilterTabs>

            {loading ? (
                <EmptyState>Loading...</EmptyState>
            ) : flags.length === 0 ? (
                <EmptyState>No {statusFilter} flags</EmptyState>
            ) : (
                <FlagList>
                    {flags.map(flag => (
                        <FlagCard key={flag._id}>
                            <FlagHeader>
                                <FlagInfo>
                                    <FlagTest to={`/admin/tests/${flag.testId?._id}/edit`}>
                                        {flag.testId?.title || 'Unknown test'}
                                    </FlagTest>
                                    {flag.questionIndex != null && (
                                        <FlagMeta>Question {flag.questionIndex + 1}</FlagMeta>
                                    )}
                                    <FlagMeta>
                                        By {flag.userId?.displayName || flag.userId?.email || 'Unknown'}
                                        {' '}&middot; {new Date(flag.createdAt).toLocaleDateString()}
                                    </FlagMeta>
                                </FlagInfo>
                                <FlagReason>{REASON_LABELS[flag.reason] || flag.reason}</FlagReason>
                            </FlagHeader>

                            {flag.note && <FlagNote>{flag.note}</FlagNote>}

                            {statusFilter === 'open' && (
                                <FlagActions>
                                    <ResolutionInput
                                        placeholder="Resolution note (optional)"
                                        value={resolutions[flag._id] || ''}
                                        onChange={e => setResolutions(prev => ({
                                            ...prev,
                                            [flag._id]: e.target.value
                                        }))}
                                    />
                                    <ResolveBtn
                                        onClick={() => handleUpdateFlag(flag._id, 'resolved')}
                                        disabled={updating[flag._id]}
                                    >
                                        Resolve
                                    </ResolveBtn>
                                    <ActionBtn
                                        onClick={() => handleUpdateFlag(flag._id, 'dismissed')}
                                        disabled={updating[flag._id]}
                                    >
                                        Dismiss
                                    </ActionBtn>
                                </FlagActions>
                            )}

                            {flag.resolution && (
                                <FlagNote>Resolution: {flag.resolution}</FlagNote>
                            )}
                        </FlagCard>
                    ))}
                </FlagList>
            )}

            {nextCursor && (
                <LoadMoreButton onClick={() => fetchFlags(nextCursor, true)}>
                    Load more
                </LoadMoreButton>
            )}
        </div>
    );
}

export default AdminFlags;
```

**Step 2: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/pages/AdminFlags.jsx
git commit -m "feat: implement admin flags moderation page"
```

---

## Task 14: Admin Test Editor Page

**Files:**
- Modify: `client/src/pages/AdminTestEditor.jsx` (replace placeholder)

**Step 1: Implement the full AdminTestEditor page**

Replace `client/src/pages/AdminTestEditor.jsx` with a full implementation. This is a large component. Key sections:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Styled components for the editor layout
const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const BackLink = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`;

const TitleInput = styled.input`
  width: 100%;
  font-size: ${({ theme }) => theme.typography.scale.h2.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h2.weight};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  background: transparent;
  font-family: inherit;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.focus.ring};
    background: ${({ theme }) => theme.colors.bg.surface};
  }
`;

const MetaRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const MetaInput = styled.input`
  flex: 1;
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
`;

const DescTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[6]}px;
`;

const QuestionCard = styled.div`
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const QuestionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const QuestionNum = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.faint};
`;

const TypeSelect = styled.select`
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
`;

const DeleteQBtn = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: 18px;
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[1]}px;
  &:hover { color: ${({ theme }) => theme.colors.state.danger}; }
`;

const QTextarea = styled.textarea`
  width: 100%;
  min-height: 60px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  resize: vertical;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[2]}px;
`;

const OptionCheck = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const OptionInput = styled.input`
  flex: 1;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const SmallBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${({ theme }) => theme.colors.state.danger}; color: ${({ theme }) => theme.colors.state.danger}; }
`;

const AddBtn = styled.button`
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[4]}px;
  border: 1px dashed ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  cursor: pointer;
  margin-top: ${({ theme }) => theme.layout.space[2]}px;
  &:hover { border-color: ${({ theme }) => theme.colors.accent.indigo}; color: ${({ theme }) => theme.colors.accent.indigo}; }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.layout.space[2]}px;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[1]}px;
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.accent.indigo};
`;

const ChipRemove = styled.button`
  background: none;
  border: none;
  color: inherit;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  &:hover { opacity: 0.7; }
`;

const ExplanationInput = styled.textarea`
  width: 100%;
  min-height: 40px;
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.muted};
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  resize: vertical;
  margin-top: ${({ theme }) => theme.layout.space[3]}px;
`;

const BottomBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
  padding-top: ${({ theme }) => theme.layout.space[5]}px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.subtle};
`;

const SaveBtn = styled.button`
  height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: 0 ${({ theme }) => theme.layout.space[6]}px;
  background: ${({ theme }) => theme.colors.accent.indigo};
  color: #fff;
  border: none;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-weight: 550;
  font-family: inherit;
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const ErrorMsg = styled.p`
  color: ${({ theme }) => theme.colors.state.danger};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  margin-bottom: ${({ theme }) => theme.layout.space[4]}px;
`;

const SectionLabel = styled.label`
  display: block;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin-bottom: ${({ theme }) => theme.layout.space[1]}px;
`;

const QUESTION_TYPES = [
    { value: 'mcq-single', label: 'MCQ (single)' },
    { value: 'mcq-multiple', label: 'MCQ (multiple)' },
    { value: 'short-answer', label: 'Short answer' },
    { value: 'ordering', label: 'Ordering' },
    { value: 'fill-in-the-blank', label: 'Fill in the blank' }
];

function makeEmptyQuestion(type = 'mcq-single') {
    const base = { text: '', type, explanation: '', options: [], acceptedAnswers: [], correctOrder: [], blanks: [] };
    if (type === 'mcq-single' || type === 'mcq-multiple') {
        base.options = [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
        ];
    }
    return base;
}

function AdminTestEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [level, setLevel] = useState('');
    const [unit, setUnit] = useState('');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [chipInputs, setChipInputs] = useState({});

    useEffect(() => {
        if (!authLoading && !user?.isAdmin) {
            navigate('/');
            return;
        }

        if (!authLoading && user?.isAdmin) {
            api.get(`/api/tests/${id}`)
                .then(res => {
                    const t = res.data;
                    setTitle(t.title || '');
                    setCategory(t.category || '');
                    setDescription(t.description || '');
                    setLevel(t.level || '');
                    setUnit(t.unit || '');
                    setQuestions(t.questions || []);
                })
                .catch(err => {
                    setError('Failed to load test');
                    console.error(err);
                })
                .finally(() => setLoading(false));
        }
    }, [id, authLoading, user, navigate]);

    const updateQuestion = (idx, updates) => {
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...updates } : q));
    };

    const updateOption = (qIdx, oIdx, updates) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = q.options.map((o, j) => j === oIdx ? { ...o, ...updates } : o);
            return { ...q, options };
        }));
    };

    const toggleCorrect = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const options = q.options.map((o, j) => {
                if (q.type === 'mcq-single') {
                    return { ...o, isCorrect: j === oIdx };
                }
                return j === oIdx ? { ...o, isCorrect: !o.isCorrect } : o;
            });
            return { ...q, options };
        }));
    };

    const addOption = (qIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, options: [...q.options, { text: '', isCorrect: false }] } : q
        ));
    };

    const removeOption = (qIdx, oIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, options: q.options.filter((_, j) => j !== oIdx) } : q
        ));
    };

    const addAcceptedAnswer = (qIdx, value) => {
        if (!value.trim()) return;
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, acceptedAnswers: [...(q.acceptedAnswers || []), value.trim()] } : q
        ));
        setChipInputs(prev => ({ ...prev, [qIdx]: '' }));
    };

    const removeAcceptedAnswer = (qIdx, aIdx) => {
        setQuestions(prev => prev.map((q, i) =>
            i === qIdx ? { ...q, acceptedAnswers: q.acceptedAnswers.filter((_, j) => j !== aIdx) } : q
        ));
    };

    const changeType = (qIdx, newType) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const updated = { ...q, type: newType };
            if ((newType === 'mcq-single' || newType === 'mcq-multiple') && (!q.options || q.options.length === 0)) {
                updated.options = [
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false }
                ];
            }
            return updated;
        }));
    };

    const deleteQuestion = (idx) => {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, makeEmptyQuestion()]);
    };

    const handleSave = async () => {
        setError(null);

        // Basic validation
        if (!title.trim()) {
            setError('Title is required');
            return;
        }
        if (questions.length === 0) {
            setError('At least one question is required');
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) {
                setError(`Question ${i + 1} has no text`);
                return;
            }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && (!q.options || q.options.length < 2)) {
                setError(`Question ${i + 1} needs at least 2 options`);
                return;
            }
            if ((q.type === 'mcq-single' || q.type === 'mcq-multiple') && !q.options.some(o => o.isCorrect)) {
                setError(`Question ${i + 1} needs at least one correct option`);
                return;
            }
            if (q.type === 'short-answer' && (!q.acceptedAnswers || q.acceptedAnswers.length === 0)) {
                setError(`Question ${i + 1} needs at least one accepted answer`);
                return;
            }
        }

        setSaving(true);
        try {
            await api.patch(`/api/admin/tests/${id}`, {
                title, category, description, level, unit, questions
            });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) return null;

    return (
        <div>
            <BackLink onClick={() => navigate('/')}>&larr; Back to tests</BackLink>

            <TitleInput
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Test title"
            />

            <MetaRow>
                <MetaInput
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Category"
                />
                <MetaInput
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                    placeholder="Level (e.g. Level 2)"
                />
                <MetaInput
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="Unit (e.g. Unit 5)"
                />
            </MetaRow>

            <DescTextarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description (optional)"
            />

            {error && <ErrorMsg>{error}</ErrorMsg>}

            {questions.map((q, qIdx) => (
                <QuestionCard key={qIdx}>
                    <QuestionHeader>
                        <QuestionNum>Q{qIdx + 1}</QuestionNum>
                        <TypeSelect
                            value={q.type || 'mcq-single'}
                            onChange={e => changeType(qIdx, e.target.value)}
                        >
                            {QUESTION_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </TypeSelect>
                        <DeleteQBtn
                            onClick={() => deleteQuestion(qIdx)}
                            aria-label={`Delete question ${qIdx + 1}`}
                        >
                            &times;
                        </DeleteQBtn>
                    </QuestionHeader>

                    <QTextarea
                        value={q.text}
                        onChange={e => updateQuestion(qIdx, { text: e.target.value })}
                        placeholder="Question text"
                    />

                    {/* MCQ options */}
                    {(q.type === 'mcq-single' || q.type === 'mcq-multiple') && (
                        <>
                            <SectionLabel>Options (check = correct)</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <OptionCheck
                                        type={q.type === 'mcq-single' ? 'radio' : 'checkbox'}
                                        name={`q${qIdx}-correct`}
                                        checked={opt.isCorrect}
                                        onChange={() => toggleCorrect(qIdx, oIdx)}
                                    />
                                    <OptionInput
                                        value={opt.text}
                                        onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })}
                                        placeholder={`Option ${oIdx + 1}`}
                                    />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>+ Add option</AddBtn>
                        </>
                    )}

                    {/* Short answer accepted answers */}
                    {q.type === 'short-answer' && (
                        <>
                            <SectionLabel>Accepted answers</SectionLabel>
                            <ChipRow>
                                {(q.acceptedAnswers || []).map((ans, aIdx) => (
                                    <Chip key={aIdx}>
                                        {ans}
                                        <ChipRemove onClick={() => removeAcceptedAnswer(qIdx, aIdx)}>
                                            &times;
                                        </ChipRemove>
                                    </Chip>
                                ))}
                            </ChipRow>
                            <OptionRow>
                                <OptionInput
                                    value={chipInputs[qIdx] || ''}
                                    onChange={e => setChipInputs(prev => ({ ...prev, [qIdx]: e.target.value }))}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addAcceptedAnswer(qIdx, chipInputs[qIdx] || '');
                                        }
                                    }}
                                    placeholder="Type answer and press Enter"
                                />
                                <SmallBtn onClick={() => addAcceptedAnswer(qIdx, chipInputs[qIdx] || '')}>
                                    Add
                                </SmallBtn>
                            </OptionRow>
                        </>
                    )}

                    {/* Ordering items */}
                    {q.type === 'ordering' && (
                        <>
                            <SectionLabel>Items (in correct order)</SectionLabel>
                            {(q.options || []).map((opt, oIdx) => (
                                <OptionRow key={oIdx}>
                                    <span style={{ color: '#7B8086', fontSize: 12, minWidth: 20 }}>{oIdx + 1}.</span>
                                    <OptionInput
                                        value={opt.text}
                                        onChange={e => updateOption(qIdx, oIdx, { text: e.target.value })}
                                        placeholder={`Item ${oIdx + 1}`}
                                    />
                                    <SmallBtn onClick={() => removeOption(qIdx, oIdx)}>&times;</SmallBtn>
                                </OptionRow>
                            ))}
                            <AddBtn onClick={() => addOption(qIdx)}>+ Add item</AddBtn>
                        </>
                    )}

                    {/* Fill in the blank */}
                    {q.type === 'fill-in-the-blank' && (
                        <>
                            <SectionLabel>
                                Use ___ in the question text to mark blanks.
                                Add accepted answers for each blank below.
                            </SectionLabel>
                            {(q.blanks || []).map((blank, bIdx) => (
                                <div key={bIdx} style={{ marginBottom: 8 }}>
                                    <SectionLabel>Blank {bIdx + 1} answers</SectionLabel>
                                    <ChipRow>
                                        {(blank.acceptedAnswers || []).map((ans, aIdx) => (
                                            <Chip key={aIdx}>
                                                {ans}
                                                <ChipRemove onClick={() => {
                                                    setQuestions(prev => prev.map((q2, i) => {
                                                        if (i !== qIdx) return q2;
                                                        const blanks = q2.blanks.map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: b.acceptedAnswers.filter((_, k) => k !== aIdx) };
                                                        });
                                                        return { ...q2, blanks };
                                                    }));
                                                }}>
                                                    &times;
                                                </ChipRemove>
                                            </Chip>
                                        ))}
                                    </ChipRow>
                                    <OptionRow>
                                        <OptionInput
                                            value={chipInputs[`${qIdx}-blank-${bIdx}`] || ''}
                                            onChange={e => setChipInputs(prev => ({
                                                ...prev,
                                                [`${qIdx}-blank-${bIdx}`]: e.target.value
                                            }))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = chipInputs[`${qIdx}-blank-${bIdx}`]?.trim();
                                                    if (!val) return;
                                                    setQuestions(prev => prev.map((q2, i) => {
                                                        if (i !== qIdx) return q2;
                                                        const blanks = q2.blanks.map((b, j) => {
                                                            if (j !== bIdx) return b;
                                                            return { ...b, acceptedAnswers: [...b.acceptedAnswers, val] };
                                                        });
                                                        return { ...q2, blanks };
                                                    }));
                                                    setChipInputs(prev => ({ ...prev, [`${qIdx}-blank-${bIdx}`]: '' }));
                                                }
                                            }}
                                            placeholder="Type answer and press Enter"
                                        />
                                    </OptionRow>
                                </div>
                            ))}
                            <AddBtn onClick={() => {
                                setQuestions(prev => prev.map((q2, i) =>
                                    i === qIdx ? { ...q2, blanks: [...(q2.blanks || []), { acceptedAnswers: [] }] } : q2
                                ));
                            }}>
                                + Add blank
                            </AddBtn>
                        </>
                    )}

                    <ExplanationInput
                        value={q.explanation || ''}
                        onChange={e => updateQuestion(qIdx, { explanation: e.target.value })}
                        placeholder="Explanation (optional)"
                    />
                </QuestionCard>
            ))}

            <BottomBar>
                <AddBtn onClick={addQuestion}>+ Add question</AddBtn>
                <SaveBtn onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save changes'}
                </SaveBtn>
            </BottomBar>
        </div>
    );
}

export default AdminTestEditor;
```

**Step 2: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/pages/AdminTestEditor.jsx
git commit -m "feat: implement admin test editor with all question types"
```

---

## Task 15: Flag Count Badge in Nav

**Files:**
- Modify: `client/src/App.jsx` (Navigation component)

**Step 1: Add badge count to Flags nav link**

In the Navigation component, fetch the open flags count when user is admin:

```jsx
const [flagCount, setFlagCount] = useState(0);

useEffect(() => {
    if (user?.isAdmin) {
        api.get('/api/admin/flags/count')
            .then(res => setFlagCount(res.data.openCount))
            .catch(() => {});
    }
}, [user]);
```

Import `api`:

```js
import api from './utils/api';
```

Add a Badge styled component:

```jsx
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: ${({ theme }) => theme.layout.radius.pill}px;
  background: ${({ theme }) => theme.colors.state.warning};
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  margin-left: ${({ theme }) => theme.layout.space[1]}px;
`;
```

Update the Flags nav link to show badge:

```jsx
{user?.isAdmin && (
    <NavLink to="/admin/flags" active={location.pathname.startsWith('/admin/flags') ? 1 : 0}>
        Flags{flagCount > 0 && <Badge>{flagCount}</Badge>}
    </NavLink>
)}
```

**Step 2: Build and verify**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add client/src/App.jsx
git commit -m "feat: add open flags count badge to admin nav"
```

---

## Task 16: Update .env Files & Verify Full Stack

**Files:**
- Modify: `server/.env` (add auth env vars)
- Modify: `.env.example`

**Step 1: Add required env vars to server/.env**

The user needs to add these to `server/.env`:

```
GOOGLE_CLIENT_ID=<their-google-client-id>
GOOGLE_CLIENT_SECRET=<their-google-client-secret>
JWT_SECRET=<random-string-at-least-32-chars>
ADMIN_EMAIL=<their-google-email>
CLIENT_URL=http://localhost:5173
```

**Step 2: Verify full server starts**

```bash
cd server && node index.js
```
Expected: Server starts on port 5000 without errors. MongoDB connects.

**Step 3: Verify frontend builds**

```bash
cd client && npm run build
```
Expected: Build succeeds.

**Step 4: Run lint**

```bash
cd client && npm run lint
```
Expected: No errors.

**Step 5: Update IMPLEMENTATION_PLAN.md to mark Phase 4 complete**

**Step 6: Commit**

```bash
git add IMPLEMENTATION_PLAN.md
git commit -m "docs: mark Phase 4 complete in implementation plan"
```

---

## Dependency Graph

```
Task 1 (deps)
  └─ Task 2 (User model)
       └─ Task 3 (auth middleware)
            └─ Task 4 (passport + auth routes)
                 ├─ Task 5 (AuthContext + axios)
                 │    └─ Task 6 (nav auth UI)
                 │         ├─ Task 8 (frontend API calls)
                 │         │    └─ Task 9 (gate admin UI)
                 │         │         └─ Task 15 (flag badge)
                 │         └─ Task 12 (flag UI)
                 ├─ Task 7 (admin routes)
                 │    └─ Task 8 (frontend API calls)
                 ├─ Task 10 (attempt userId)
                 ├─ Task 11 (flag model + routes)
                 │    ├─ Task 12 (flag UI)
                 │    └─ Task 13 (admin flags page)
                 └─ Task 14 (admin test editor)
Task 16 (final verification) — depends on all above
```

**Parallelizable groups:**
- After Task 6: Tasks 7, 10, 11 can run in parallel
- After Task 11: Tasks 12, 13 can run in parallel
- Task 14 can run after Task 7
