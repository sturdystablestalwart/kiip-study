# Phase 2 — Instant Library UX Design

**Date:** 2026-02-15 | **Status:** Approved

## Goal

Users can find any test quickly via search (Ctrl+P command palette) and browse the library with pagination and filters. Keyboard shortcuts enhance navigation throughout.

## Architecture

### Schema Changes

Add optional fields to Test model:

```js
level: { type: String },   // e.g. "Level 2"
unit:  { type: String },   // e.g. "Unit 5"
```

Add indexes:

```js
TestSchema.index({ title: 'text', category: 'text', description: 'text' });
TestSchema.index({ level: 1, unit: 1, createdAt: -1 });
```

### API: GET /api/tests (rewritten)

**Query params:** `?q=&level=&unit=&cursor=&limit=20`

- `q` — Full-text search via MongoDB `$text` on title/category/description
- `level` / `unit` — Exact match filters
- `cursor` — `_id` of last item (cursor pagination)
- `limit` — Default 20, max 50

**Response:**

```json
{
  "tests": [{ ...test, lastAttempt: {...} }],
  "nextCursor": "abc123" | null,
  "total": 47
}
```

Single aggregation pipeline replaces N+1 queries:

```
$match → $sort(createdAt:-1, _id:-1) → $limit(n+1) → $lookup(attempts)
```

Fetch `limit + 1` to detect next page. Pop extra if present, set `nextCursor`.

### Home Page Layout

```
┌─────────────────────────────────────────────────┐
│  KIIP Study    [🔍 Search tests...  ⌘P]  Tests  New │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─── Continue Last Session ──────────────────┐ │
│  │  "KIIP Level 2 Unit 5"     12/20    78%    │ │
│  │  Practice mode · 3 min ago      [Continue] │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  Recent Attempts (last 5)                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ 85%  │ │ 72%  │ │ 90%  │ │ 65%  │ │ 80%  │ │
│  │ U5   │ │ U3   │ │ U7   │ │ U1   │ │ U4   │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│                                                 │
│  All Tests                      Level ▾  Unit ▾ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Card     │ │ Card     │ │ Card     │       │
│  └──────────┘ └──────────┘ └──────────┘       │
│                                                 │
│           [ Load more tests ]                   │
└─────────────────────────────────────────────────┘
```

- **Continue card** — Most recent attempt. Links to `/test/:id`. Hidden if no attempts.
- **Recent attempts** — Horizontal row of last 5 attempts (score %, test title snippet). Each links to test.
- **Filter dropdowns** — Level and Unit selectors, filter via API params.
- **Test grid** — Existing card grid, cursor-paginated.
- **Load more** — Button fetches next page and appends.

### Navbar Search Trigger

A compact pill-shaped element in the navbar (between logo and nav links). Clicking it or focusing it opens the Command Palette. Shows "Ctrl+P" hint. Works from every page.

### Ctrl+P Command Palette

Modal overlay rendered at App level. VSCode-style:

- Auto-focused text input
- 300ms debounced search hitting `GET /api/tests?q=&limit=10`
- Results list with arrow key navigation + Enter to open
- Shows test title, question count, last score
- Escape or click-outside to close
- No external dependencies

### Ctrl+K Shortcuts Modal

Static reference modal at App level:

| Shortcut | Action |
|----------|--------|
| Ctrl+P | Open command palette |
| Ctrl+K | Show shortcuts panel |
| 1-4 | Select option (during test) |
| Arrow keys | Navigate questions / palette results |
| Enter | Confirm action |
| Esc | Close modal |

### Keyboard Navigation in TestTaker

- `1`, `2`, `3`, `4` keys select corresponding option
- `ArrowRight` / `ArrowLeft` for next/prev question (if applicable)
- `Enter` confirms

## Components

```
client/src/
├── components/
│   ├── CommandPalette.jsx     # Ctrl+P modal — search UI
│   ├── ShortcutsModal.jsx     # Ctrl+K modal — shortcut reference
│   └── FilterDropdown.jsx     # Level/Unit filter select
├── pages/
│   └── Home.jsx               # Redesigned with dashboard sections
└── App.jsx                    # Nav search trigger + global key listeners
```

## Files Touched

| Action | File |
|--------|------|
| Modify | `server/models/Test.js` — add level, unit, indexes |
| Modify | `server/routes/tests.js` — rewrite GET /, aggregation pipeline |
| Create | `client/src/components/CommandPalette.jsx` |
| Create | `client/src/components/ShortcutsModal.jsx` |
| Create | `client/src/components/FilterDropdown.jsx` |
| Modify | `client/src/pages/Home.jsx` — redesign with dashboard sections |
| Modify | `client/src/pages/TestTaker.jsx` — keyboard nav |
| Modify | `client/src/App.jsx` — nav search trigger, global key listeners |
| Modify | `IMPLEMENTATION_PLAN.md` — mark Phase 2 done |
