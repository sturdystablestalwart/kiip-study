# Phase 4: Admin Suite & Authentication — Design Document

**Goal:** Add Google OAuth authentication, admin role guards, admin test editor, and user flag system to transition from open-access to admin-curated platform.

**Architecture:** Passport.js Google OAuth strategy with JWT in httpOnly cookies. Two middleware layers (requireAuth, requireAdmin) guard routes. Admin features live under `/api/admin/` prefix. Flag system enables user-reported content issues with admin moderation queue.

**Tech Stack:** passport-google-oauth20, jsonwebtoken, bcryptjs (installed), cookie-parser, styled-components, React Context for auth state.

---

## Section 1: Authentication (Approved)

### User Model — `server/models/User.js`

```js
{
  email: { type: String, required: true, unique: true },
  googleId: { type: String, required: true, unique: true },
  displayName: String,
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}
```

### Google OAuth Flow

1. Frontend: "Sign in with Google" button calls `GET /api/auth/google/start`
2. Server: Passport redirects to Google consent screen
3. Google redirects back to `GET /api/auth/google/callback`
4. Passport verify callback: find-or-create User by `googleId`
5. If `email === process.env.ADMIN_EMAIL`, set `isAdmin: true`
6. Sign JWT with `{ userId, isAdmin }`, set as httpOnly cookie (7-day expiry)
7. Redirect to frontend `/`

### JWT Cookie Configuration

- `httpOnly: true` — not accessible from JavaScript
- `secure: true` in production (HTTPS only)
- `sameSite: 'lax'` — CSRF protection
- `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days)
- `path: '/'`

### Auth Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/auth/google/start` | Initiate Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback, set JWT cookie |
| `GET` | `/api/auth/me` | Return current user (from JWT) |
| `POST` | `/api/auth/logout` | Clear JWT cookie |

### Frontend AuthContext

- `AuthProvider` wraps app, calls `GET /api/auth/me` on mount
- `useAuth()` hook returns `{ user, loading, logout }`
- Nav shows "Sign in" or user display name + "Sign out"
- Components check `user?.isAdmin` for admin UI visibility

---

## Section 2: Admin Route Guards & Middleware (Approved)

### Middleware — `server/middleware/auth.js`

**`requireAuth(req, res, next)`:**
- Reads JWT from httpOnly cookie
- Verifies with `JWT_SECRET`
- Looks up User by `userId` from token
- Attaches `req.user` (User document)
- Returns 401 if missing/invalid/user not found

**`requireAdmin(req, res, next)`:**
- Runs after `requireAuth`
- Checks `req.user.isAdmin === true`
- Returns 403 if not admin

### Route Guard Matrix

| Route pattern | Guard | Reason |
|---|---|---|
| `GET /api/tests`, `GET /api/tests/:id` | None | Public test library |
| `POST /api/tests/:id/attempt` | `requireAuth` | Per-user progress |
| `GET /api/endless`, `POST /api/endless/attempt` | `requireAuth` | Per-user progress |
| `POST /api/admin/tests/import` | `requireAdmin` | Admin-only |
| `POST /api/admin/tests/generate` | `requireAdmin` | Admin-only |
| `POST /api/admin/tests/generate-from-file` | `requireAdmin` | Admin-only |
| `PATCH /api/admin/tests/:id` | `requireAdmin` | Admin-only |
| `DELETE /api/admin/tests/:id` | `requireAdmin` | Admin-only |
| `POST /api/flags` | `requireAuth` | User flag submission |
| `GET /api/admin/flags` | `requireAdmin` | Admin moderation |
| `PATCH /api/admin/flags/:id` | `requireAdmin` | Admin moderation |

### Admin Seeding

First user to sign in with `ADMIN_EMAIL` env var gets `isAdmin: true`. All others default to `false`.

---

## Section 3: Admin Test Import & Generation (Approved)

### Route Restructuring

New file: `server/routes/admin.js` — all admin endpoints.

**Routes that move from `tests.js` to `admin.js`:**

| Current | New |
|---|---|
| `POST /api/tests/generate` | `POST /api/admin/tests/generate` |
| `POST /api/tests/generate-from-file` | `POST /api/admin/tests/generate-from-file` |
| `POST /api/tests/upload` | `POST /api/admin/tests/upload` |
| `POST /api/tests/upload-multiple` | `POST /api/admin/tests/upload-multiple` |
| `DELETE /api/tests/:id` | `DELETE /api/admin/tests/:id` |

**Routes that stay in `tests.js`:**

| Route | Reason |
|---|---|
| `GET /api/tests` | Public library |
| `GET /api/tests/:id` | Public test access |
| `POST /api/tests/:id/attempt` | User-facing (gets `requireAuth`) |
| `GET /api/endless` | User-facing (gets `requireAuth`) |
| `POST /api/endless/attempt` | User-facing (gets `requireAuth`) |
| `GET /api/recent-attempts` | User-facing (gets `requireAuth`, filters by userId) |

### New Import Endpoint

`POST /api/admin/tests/import` — accepts JSON body with full test data (title, category, description, questions), validates question types and fields, creates Test document directly (no AI).

### Frontend Changes

- `CreateTest` page updates API URLs to `/api/admin/tests/...`
- "New Test" nav link only visible when `useAuth().user?.isAdmin`

---

## Section 4: Admin Test Editor (Approved)

### Page

`client/src/pages/AdminTestEditor.jsx` — route `/admin/tests/:id/edit`

### Layout

- **Top bar:** Editable test title (inline), category dropdown, description textarea
- **Question list:** Scrollable cards, each editable
- **Bottom bar:** "Add Question" button + Save button

### Question Card (per type)

- Type selector dropdown (mcq-single, mcq-multiple, short-answer, ordering, fill-in-the-blank)
- Question text textarea
- Type-specific fields:
  - **MCQ single/multiple:** Option list with add/remove, checkboxes for correct answers
  - **Short answer:** Accepted answers as add/remove chips
  - **Ordering:** Items list with drag reorder for correct order
  - **Fill-in-the-blank:** Text with `___` markers, accepted answers per blank
- Explanation textarea (optional)
- Delete question button (with confirmation)

### Validation

- Every question must have text
- MCQ: at least 2 options, at least 1 correct
- Short answer: at least 1 accepted answer
- Ordering: at least 2 items
- Fill-in-the-blank: at least 1 `___` marker with accepted answers

### Access Control

- Route guarded in `App.jsx` — redirects to `/` if not admin
- "Edit" button on Home test cards visible only to admins

---

## Section 5: User Flags & Admin Flags Queue (Approved)

### Flag Model — `server/models/Flag.js`

```js
{
  userId: ObjectId (ref: 'User'),
  testId: ObjectId (ref: 'Test'),
  questionIndex: Number (optional),
  reason: String (enum: ['incorrect-answer', 'unclear-question', 'typo', 'other']),
  note: String (optional),
  status: String (enum: ['open', 'resolved', 'dismissed'], default: 'open'),
  resolution: String (optional),
  createdAt: Date,
  updatedAt: Date
}
```

### User-Facing

- Flag icon button on each question in TestTaker and review mode
- Click opens modal: reason dropdown + optional note + Submit
- `POST /api/flags` — `requireAuth`, creates/upserts Flag (one per user per question)
- Toast confirmation on submit

### Admin-Facing

- Page: `client/src/pages/AdminFlags.jsx` — route `/admin/flags`
- List view: newest first, shows test title, question preview, reason, user email, date
- Each row: "Resolve" (with note input) and "Dismiss" buttons
- `GET /api/admin/flags?status=open&cursor=&limit=20` — cursor-paginated
- `PATCH /api/admin/flags/:id` — updates status + resolution
- Link from flag row to test editor (jump to question)

### Nav

- Admin sees "Flags" nav link with open-count badge
- Non-admins don't see it

---

## Section 6: Anonymous Progress Migration (Approved)

### Decision: No Migration (Clean Break)

- App is pre-launch with only dev/test data — no real user progress to preserve
- Existing anonymous attempts stay in DB (no userId field)
- New attempts after auth require login and get `userId` attached

### Changes

- `Attempt` model gets `userId: { type: Schema.Types.ObjectId, ref: 'User' }` (optional for backward compat)
- Attempt-creating endpoints require `requireAuth`, set `userId: req.user._id`
- `GET /api/recent-attempts` filters by `userId: req.user._id`
- Old anonymous attempts remain but are invisible (no userId match)

---

## New Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_CLIENT_ID` | Yes (for auth) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes (for auth) | Google OAuth client secret |
| `JWT_SECRET` | Yes (for auth) | JWT signing secret |
| `ADMIN_EMAIL` | Yes (for seeding) | Email of first admin user |
