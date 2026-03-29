# Magic Link Auth + Anonymous Progress — Design Spec

**Goal:** Add passwordless magic link authentication alongside existing Google OAuth, with anonymous test-taking that preserves progress on sign-up.

**Date:** 2026-03-30

---

## 1. Auth Flow

1. User clicks "Sign in" in navbar → auth modal opens
2. Modal shows: email field + "Send magic link" button + divider "or" + Google button
3. Server generates token (`crypto.randomBytes(32).toString('base64url')`), stores SHA-256 hash in `MagicLink` collection, sends raw token in email (localized to current UI language)
4. Modal switches to "Check your email" state: masked email, Resend button (60s cooldown), "Wrong email?" link
5. User clicks link → `GET /auth/magic/verify?token=...` → server verifies hash, creates/finds User, issues JWT cookie (same format as Google OAuth), redirects to `CLIENT_URL`
6. If email matches existing Google user → accounts merge (same User document, `authMethods` updated)

### Security

| Parameter | Value |
|-----------|-------|
| Token entropy | 256 bits (`crypto.randomBytes(32)`) |
| Token storage | SHA-256 hash in DB, raw in email |
| Token expiry | 10 minutes |
| One-time use | Atomic `findOneAndUpdate({ tokenHash, used: false })` |
| Rate limit (send) | 3 req/email/10min, 15 req/IP/10min |
| Email enumeration | Always respond "If this email exists, we sent a link" |
| Pending tokens | Invalidate all prior tokens for same email on new request |

---

## 2. Anonymous Progress

### Before auth:
- First visit generates `anonymousId` (`crypto.randomUUID()`) in localStorage
- Anonymous users take tests normally, but attempts save to **localStorage only** — not to DB
- Storage key: `kiip_attempts` — array of attempt objects
- Limit: last 50 attempts (prevent localStorage bloat)

### On auth (magic link or Google):
- Client reads localStorage; if anonymous attempts exist → sends batch to `POST /api/attempts/migrate`
- Server validates and saves to Attempt collection with new `userId`
- Client clears localStorage after successful migration

### Implications:
- All existing `requireAuth` guards on attempt/session endpoints stay unchanged
- TestTaker.jsx saves to localStorage instead of API call when not authenticated
- AuthContext triggers migration once after successful login

---

## 3. Modal UX

### Component: `AuthModal.jsx`

**State machine:**
```
IDLE → email input + Google button
SENDING → spinner on button, input disabled
CHECK_EMAIL → masked email, Resend (60s cooldown), "Wrong email?"
```

**Design (Japandi):**
- Triggered by "Sign in" button in navbar
- Overlay + ModalCard (matches existing project modals)
- Title: "Sign in to KIIP Study" (localized)
- Email field + "Send magic link" button (clay accent)
- Horizontal divider with "or"
- Google button (outline style)
- Closes on Escape and overlay click

### Verify page: `/auth/verify`

Not a modal — a standalone page (user arrives from email, possibly different tab).

States:
- "Signing you in..." (verifying)
- Success → redirect to home
- Error → specific message (expired / already used / invalid) + "Request new link" button

---

## 4. Data Model & API

### New collection: `MagicLink`

```js
{
  tokenHash: String,        // SHA-256 of raw token, indexed unique
  email: String,
  lang: String,             // en | ko | ru | es
  expiresAt: Date,          // TTL index, auto-deleted by MongoDB
  used: { type: Boolean, default: false },
  usedAt: Date,
  requestedIp: String,
  requestedUA: String,
  createdAt: Date
}
```

### Changes to `User` model

- `googleId`: change from `required: true` to optional, change `unique: true` to sparse unique index (allows multiple null values)
- Add field: `authMethods: [{ type: String, enum: ['google', 'magic'] }]`

### New endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/magic/send` | Accepts `{ email, lang }`, generates token, sends email |
| `GET` | `/api/auth/magic/verify?token=` | Verifies token, creates/finds User, issues JWT cookie, redirects |
| `POST` | `/api/attempts/migrate` | Accepts array of anonymous attempts, saves with userId (requireAuth) |

### Account merge logic (in verify):

1. Find User by email
2. If found (Google user) → add `'magic'` to `authMethods`, issue JWT
3. If not found → create new User without googleId, `authMethods: ['magic']`
4. Admin assignment: same `ADMIN_EMAIL` logic as Google OAuth

### Rate limiting

`/api/auth/magic/send`: 3 req/email/10min, 15 req/IP/10min

---

## 5. Email

### Transport: Nodemailer + Gmail SMTP

```
Host: smtp.gmail.com:587 (STARTTLS)
Auth: Gmail App Password
```

### Env variables

```
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=KIIP Study <your@gmail.com>
```

**Dev fallback:** If `SMTP_USER` is not set, log the magic link URL to server console.

### Email template — 4 languages

Subjects:
- EN: "Your sign-in link for KIIP Study"
- KO: "KIIP Study 로그인 링크"
- RU: "Ссылка для входа в KIIP Study"
- ES: "Tu enlace de inicio de sesion en KIIP Study"

Body: minimal HTML — one "Sign in" button, "Link expires in 10 minutes", footer "If you didn't request this, ignore this email." All localized.

Template location: `server/utils/magicLinkEmail.js` — single file, switch by lang. Japandi style: off-white background, clay accent button, Inter font.

---

## 6. Changes to Existing Code

### Server

| File | Change |
|------|--------|
| `server/models/User.js` | `googleId` optional, add `authMethods` field |
| `server/routes/auth.js` | Add `magic/send` and `magic/verify` routes; Google callback adds `'google'` to `authMethods` |
| `server/middleware/auth.js` | No changes — JWT cookie flow is identical |

### Client

| File | Change |
|------|--------|
| `client/src/context/AuthContext.jsx` | After `/api/auth/me` success → check localStorage for anonymous attempts → call migrate endpoint |
| `client/src/pages/TestTaker.jsx` | In `handleSubmit`: if no auth → save attempt to localStorage |
| `client/src/App.jsx` | Add `/auth/verify` route; add `showAuthModal` state |

### New files (5)

| File | Purpose |
|------|---------|
| `server/models/MagicLink.js` | Mongoose model for magic link tokens |
| `server/utils/magicLinkEmail.js` | Email templates (4 languages) |
| `client/src/components/AuthModal.jsx` | Auth modal component |
| `client/src/pages/MagicLinkVerify.jsx` | Token verification page |
| `client/src/utils/anonymousAttempts.js` | localStorage manager for anonymous attempts |
