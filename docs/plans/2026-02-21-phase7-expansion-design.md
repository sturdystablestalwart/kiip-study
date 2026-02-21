# Phase 7 — Expansion Features Design Document

**Date:** 2026-02-21
**Owner:** Alex Reznitskii
**Status:** Approved

---

## Goal

Add 8 new features and security hardening to complete the KIIP Study platform beyond the original 6-phase roadmap. Features are: analytics dashboard (AnyChart), multi-language UI (EN/KO/RU/ES), mobile responsive polish, test sharing via public links, bulk import from spreadsheet, question deduplication, dark theme, and OWASP-aligned security hardening.

## Architecture

Desktop-first MERN stack (React 19, Express 5, Mongoose 9, styled-components v6). All new features follow existing patterns: styled-components with theme tokens, hooks-only state, Express route modules, Mongoose models. AnyChart (commercial, free for education) replaces lightweight chart alternatives for richer visualization. react-i18next handles 4-language UI translations. Dark theme is a parallel token set swapped via ThemeProvider.

## Tech Stack Additions

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| anychart | latest | Charting library | ~300kB |
| anychart-react | latest | React wrapper for AnyChart | ~5kB |
| react-i18next | 15.x | React i18n hooks | ~8kB |
| i18next | 25.x | i18n core framework | ~14kB |
| i18next-browser-languagedetector | 8.x | Auto-detect browser language | ~3kB |
| nanoid | 5.x | URL-safe unique IDs for sharing | 118B |
| exceljs | 4.4.x | XLSX parsing for bulk import | ~500kB |
| papaparse | 5.5.x | CSV parsing | ~6.5kB |
| string-similarity | 4.0.x | Dice coefficient text comparison | ~3kB |
| helmet | 8.x | Secure HTTP headers | ~5kB |
| express-mongo-sanitize | 2.2.x | NoSQL injection prevention | ~2kB |
| hpp | 0.2.x | HTTP parameter pollution protection | ~2kB |

---

## Feature 1: Analytics Dashboard (AnyChart)

### Data Model

No new collections. Stats are aggregated from the existing `Attempt` collection via MongoDB aggregation pipelines.

### API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/stats` | requireAuth | KPIs + accuracy trend + unit breakdown |
| `GET` | `/api/stats/question-types` | requireAuth | Per-question-type accuracy |

### `/api/stats` Response Shape

```json
{
  "kpis": {
    "totalAttempts": 47,
    "averageScore": 78.2,
    "currentStreak": 5,
    "weakestUnit": { "unit": "Unit 3", "avgScore": 52.1 }
  },
  "accuracyTrend": [
    { "date": "2026-02-01", "score": 72.0, "attempts": 3 },
    { "date": "2026-02-02", "score": 80.5, "attempts": 2 }
  ],
  "unitBreakdown": [
    { "unit": "Unit 1", "avgScore": 85.0, "attempts": 8 },
    { "unit": "Unit 3", "avgScore": 52.1, "attempts": 5 }
  ]
}
```

### `/api/stats/question-types` Response Shape

```json
{
  "types": [
    { "type": "mcq-single", "correct": 120, "total": 150, "accuracy": 80.0 },
    { "type": "mcq-multiple", "correct": 30, "total": 50, "accuracy": 60.0 },
    { "type": "short-answer", "correct": 15, "total": 25, "accuracy": 60.0 },
    { "type": "ordering", "correct": 8, "total": 12, "accuracy": 66.7 },
    { "type": "fill-in-the-blank", "correct": 10, "total": 15, "accuracy": 66.7 }
  ]
}
```

### Frontend

- New page: `client/src/pages/Dashboard.jsx`
- New route: `/dashboard` (requires auth, linked from navbar)
- Layout: 4 KPI cards (top row) → Line chart (accuracy over time) → Bar chart (score by unit) + Radar chart (by question type)
- AnyChart theming: apply Japandi palette via `anychart.theme()`, separate dark theme palette
- Code-split with `React.lazy()` to avoid loading AnyChart on other pages
- Filter dropdown: time period (7d, 30d, 90d, all), level

---

## Feature 2: Multi-Language UI (EN/KO/RU/ES)

### Architecture

```
client/src/i18n/
  index.js                    # i18next init + config
  locales/
    en/common.json            # ~150 keys
    ko/common.json
    ru/common.json
    es/common.json
```

### Translation Scope

Only UI chrome is translated:
- Navigation labels, auth buttons
- Dashboard section titles, filter labels
- TestTaker controls (modes, timer text, submit)
- CreateTest form labels, validation messages
- Admin editor labels, flags page
- Common: loading, error, cancel, save, empty states

Question content remains Korean with bilingual explanations — this is content-level, not UI-level.

### Key Groups (~150 keys)

| Namespace | Example Keys |
|-----------|-------------|
| `nav` | `nav.home`, `nav.create`, `nav.dashboard`, `nav.signIn`, `nav.signOut` |
| `home` | `home.title`, `home.allTests`, `home.loadMore`, `home.noTests` |
| `test` | `test.practice`, `test.exam`, `test.submit`, `test.timer`, `test.score` |
| `create` | `create.title`, `create.textPlaceholder`, `create.generate` |
| `admin` | `admin.editor`, `admin.flags`, `admin.import`, `admin.audit` |
| `dashboard` | `dashboard.title`, `dashboard.totalAttempts`, `dashboard.avgScore` |
| `common` | `common.loading`, `common.error`, `common.cancel`, `common.save` |

### Language Picker

- Compact dropdown in navbar (next to theme toggle)
- Shows language code: EN / 한국어 / РУ / ES
- Persisted to `localStorage('i18nextLng')`
- Synced to user preferences in DB if authenticated

### Font Stack Update

Add Noto Sans KR (already available via Google Fonts CDN, auto-subsetted):
```
font-family: Inter, 'Noto Sans KR', 'BIZ UDPGothic', system-ui, ...
```

---

## Feature 3: Mobile Responsive Polish

### Breakpoint System

Added to theme tokens:
```js
breakpoints: {
  mobile: 480,
  tablet: 768,
  laptop: 1024
}
```

Helper utility:
```js
// client/src/theme/breakpoints.js
export const below = {
  mobile: '@media (max-width: 480px)',
  tablet: '@media (max-width: 768px)',
  laptop: '@media (max-width: 1024px)'
};
```

### Key Responsive Changes

| Component | Desktop | Tablet (≤768px) | Mobile (≤480px) |
|-----------|---------|-----------------|-----------------|
| App shell padding | space[8] (48px) | space[6] (32px) | space[4] (16px) |
| Test grid | 3 columns | 2 columns | 1 column |
| TestTaker controls | Top bar | Top bar | Bottom sticky bar |
| Command palette | 560px centered | 90vw centered | Full-width |
| Dashboard charts | Side-by-side | Stacked | Stacked, scrollable |
| Nav search | 200px input | Icon only | Icon only |
| Ordering questions | Drag handles | Drag handles | Tap-to-select + move up/down buttons |

### Touch Considerations

- All controls already 44px+ (WCAG compliant)
- Add 8px+ gaps between adjacent touch targets
- Command palette: full-width overlay on mobile
- Swipe gestures: none (keep simple)

---

## Feature 4: Test Sharing via Public Links

### Data Model

Add to Test schema:
```js
shareId: { type: String, unique: true, sparse: true, index: true }
```

Generated: 10-character nanoid (URL-safe alphabet: `A-Za-z0-9_-`). Created lazily on first share click (not on test creation, to avoid unnecessary IDs).

### Routes

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/api/tests/:id/share` | requireAuth | Generate shareId, return share URL |
| `GET` | `/api/shared/:shareId` | Public | Get test by share ID (read-only) |

### Public Share Page

- Route: `/shared/:shareId`
- Read-only test view: shows title, question count, metadata
- "Start Practice" button → navigates to `/test/:id` (creates session if auth'd)
- No direct question reveal (prevents cheating via share link)

### Open Graph Meta Tags

Express middleware for social crawler detection:
```js
// server/middleware/ogTags.js
// Detects: facebookexternalhit, twitterbot, kakaotalk, slackbot, telegrambot
// Returns pre-rendered HTML with og:title, og:description, og:image, og:url
```

### Share UI

- Share button (link icon) on test cards in Home and TestTaker result screen
- Click → generates shareId (if not exists) → copies URL to clipboard
- Toast: "Link copied!"

---

## Feature 5: Bulk Import from Spreadsheet

### Flow

```
Admin uploads XLSX/CSV → Server parses → Returns preview JSON
  → Admin reviews (sees validation errors per row)
  → Admin confirms → Server imports (insertMany in batches of 50)
  → Returns: { imported: N, skipped: N, errors: [...] }
```

### API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `POST` | `/api/admin/tests/bulk-import` | requireAdmin | Upload + parse + validate → preview |
| `POST` | `/api/admin/tests/bulk-import/confirm` | requireAdmin | Confirm import from preview |
| `GET` | `/api/admin/tests/import-template` | requireAdmin | Download template XLSX |

### Template Format

| Column | Required | Description |
|--------|----------|-------------|
| Test Title | Yes | Groups rows into tests |
| Question Text | Yes | Question body (Korean) |
| Type | Yes | mcq-single, mcq-multiple, short-answer, ordering, fill-in-the-blank |
| Option A-D | Conditional | For MCQ types |
| Correct Answer | Yes | Option letter(s), text, or order sequence |
| Explanation | No | Bilingual explanation |
| Level | No | Level 1-5 |
| Unit | No | Unit 1-20 |

### Validation Rules

- Required fields present
- Question type is one of 5 valid types
- MCQ has ≥2 options and ≥1 correct
- Duplicate check against existing DB (string-similarity ≥0.75)
- Character limits: question text <1000, option text <500

### Frontend

- New section in admin area or dedicated `/admin/import` page
- File upload zone (drag & drop)
- Preview table with row-by-row status (valid/error/duplicate)
- Confirm button with count summary

---

## Feature 6: Question Deduplication

### Algorithm

1. **Normalize:** lowercase, collapse whitespace, strip punctuation (preserve Hangul range `\uAC00-\uD7AF`)
2. **Compare:** Dice coefficient via `string-similarity.compareTwoStrings()`
3. **Threshold:** ≥0.90 = "almost certain duplicate", 0.75-0.89 = "likely duplicate"

### Integration Points

- **During import/generation:** Auto-check new questions against existing questions in same level/unit. Flag duplicates in preview with similarity score.
- **Admin audit:** `GET /api/admin/duplicates?level=&threshold=0.75` scans full library, returns clusters sorted by similarity.

### API

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/admin/duplicates` | requireAdmin | Scan for duplicate question clusters |

### Frontend

- Admin duplicates page: `/admin/duplicates`
- Cards showing duplicate pairs with similarity % and diff highlight
- Actions: Keep Both, Skip (mark as reviewed), Merge (pick best version)

---

## Feature 7: Security Hardening

### Middleware Stack (server/index.js)

```js
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

app.use(helmet());
app.use(mongoSanitize());  // strips $ and . from req.body/query/params
app.use(hpp());             // prevents parameter pollution
```

### Helmet Configuration

- Content-Security-Policy: script-src 'self', style-src 'self' 'unsafe-inline' (styled-components), img-src 'self' data: blob:, font-src 'self' fonts.gstatic.com, connect-src 'self' accounts.google.com
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000 (production)
- Referrer-Policy: strict-origin-when-cross-origin

### Production Error Handling

- Strip stack traces when `NODE_ENV=production`
- Generic error messages to client (no internal details)
- Log full errors server-side

### Secrets Audit

- Run gitleaks on repo history
- Verify no .env, credentials, or API keys in committed files
- Check: GEMINI_API_KEY, GOOGLE_CLIENT_SECRET, JWT_SECRET not exposed
- Add `.env` to `.gitignore` (verify)

### Input Validation Hardening

- Verify all user-facing endpoints use express-validator
- MongoDB query injection: express-mongo-sanitize handles `$` operators
- File upload: verify MIME type server-side (not just extension)

---

## Feature 8: Dark Theme

### Token Architecture

`client/src/theme/tokens.js` exports two objects:

```js
export const lightColors = {
  bg: { canvas: '#F7F2E8', surface: '#FFFFFF', surfaceAlt: '#FAF7F1' },
  border: { subtle: '#E6DDCF' },
  text: { primary: '#1F2328', muted: '#5B5F64', faint: '#7B8086' },
  accent: { clay: '#A0634A', moss: '#657655', indigo: '#2A536D' },
  state: { success: '#2F6B4F', warning: '#B07A2A', danger: '#B43A3A',
           infoBg: '#EEF3F5', correctBg: '#EEF5EF', wrongBg: '#F7EEEE' },
  focus: { ring: '#2A536D' },
  selection: { bg: '#F1E6D8' }
};

export const darkColors = {
  bg: { canvas: '#1A1A1A', surface: '#242424', surfaceAlt: '#2C2C2C' },
  border: { subtle: '#3A3A3A' },
  text: { primary: '#E8E4DC', muted: '#9A9A9A', faint: '#6A6A6A' },
  accent: { clay: '#C47A5E', moss: '#8A9B74', indigo: '#4A8BB0' },
  state: { success: '#4A9B6F', warning: '#D4A03A', danger: '#D45A5A',
           infoBg: '#1E2A2F', correctBg: '#1E2F1E', wrongBg: '#2F1E1E' },
  focus: { ring: '#4A8BB0' },
  selection: { bg: '#3A2E20' }
};
```

### Theme Context

```js
// client/src/context/ThemeContext.jsx
// State: 'light' | 'dark' | 'system'
// Default: 'system' (reads prefers-color-scheme)
// Persisted: localStorage('theme')
// Synced to DB if authenticated (PATCH /api/auth/preferences)
```

### Toggle UI

- Sun/moon icon button in navbar (between language picker and auth section)
- Click cycles: system → light → dark → system
- Tooltip shows current mode

### AnyChart Dark Theme

AnyChart themes applied dynamically when dark mode activates:
```js
anychart.theme(isDark ? darkChartTheme : lightChartTheme);
```

---

## New Routes Summary

| Route | Page | Auth |
|-------|------|------|
| `/dashboard` | Analytics Dashboard | Required |
| `/shared/:shareId` | Public Test View | Public |
| `/admin/import` | Bulk Import | Admin |
| `/admin/duplicates` | Duplicate Audit | Admin |

---

## Implementation Order

1. **Security hardening** (foundation — affects all subsequent work)
2. **Dark theme** (theme infrastructure needed by all UI features)
3. **i18n** (translation wrapper needed before building new pages)
4. **Mobile responsive** (breakpoint system applied across all pages)
5. **Analytics dashboard** (new page, uses AnyChart + theme + i18n)
6. **Test sharing** (schema change + new public route)
7. **Bulk import** (admin feature, uses dedup)
8. **Question deduplication** (integrated with import, standalone audit)

---

## Acceptance Criteria

1. Analytics dashboard shows 4 KPIs + 3 chart types with real user data
2. All UI text translatable to EN/KO/RU/ES via language picker
3. App usable on mobile (≤480px) with no horizontal overflow or broken layouts
4. Tests shareable via public links with OG meta tags for social previews
5. Admin can bulk-import tests from XLSX/CSV with preview and validation
6. Duplicate questions flagged during import and via admin audit tool
7. Dark theme toggleable with proper contrast on all elements
8. Security headers (helmet), NoSQL sanitization, and parameter pollution protection active
9. No secrets or credentials in git history
10. Playwright MCP tests verify all new functionality
