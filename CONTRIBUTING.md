# Contributing to KIIP Study

Thanks for taking the time to contribute! This guide is the minimum you need to go from `git clone` to a green PR. Deeper detail lives in [CLAUDE.md](./CLAUDE.md) — that file is the authoritative reference for coding conventions, the project map, and known pitfalls.

---

## 1. Local setup

```bash
git clone https://github.com/sturdystablestalwart/kiip-study.git
cd kiip-study
cp .env.example .env             # then fill in real values
npm run install-all              # installs server + client deps with npm ci
```

### Required env vars

The server refuses to start without these (see [`server/utils/envValidate.js`](server/utils/envValidate.js)):

- `MONGO_URI`
- `JWT_SECRET` (≥32 chars in production)
- `CLIENT_URL`
- `ADMIN_EMAIL`

Optional features degrade gracefully when missing:

- `GEMINI_API_KEY` — AI test generation + curriculum classification
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — magic-link auth (otherwise links log to console)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth sign-in

### Run the stack

```bash
# Start MongoDB (the server crashes on boot without it).
docker compose up -d mongo

# Then the app:
npm start                       # client (5173) + server (5000)
# or independently:
npm run server
npm run client
```

The first time you boot, set `ENABLE_AUTO_IMPORT=true` if you want the seed tests in `additionalContext/tests/` to be auto-imported. Production keeps this off.

---

## 2. Tests + build before opening a PR

These are the same gates CI runs:

```bash
cd client && npm run lint        # eslint, zero warnings
cd client && npm run test        # vitest (jsdom + Testing Library)
cd client && npm run build       # production bundle MUST succeed

cd server && npm run test        # vitest (supertest + mongodb-memory-server)

npx playwright test              # E2E (chromium); needs both servers up
```

`npm run test:unit` runs both client + server vitest suites in one go.

---

## 3. Coding conventions (cheat sheet)

The full list is in [CLAUDE.md](./CLAUDE.md). Highlights:

- **Styling:** styled-components only — no inline styles, no Tailwind, no CSS modules. Always use theme tokens (`${({ theme }) => theme.colors.*}`). Never hardcode colors.
- **Unified primitives:** Prefer the `client/src/components/ui/` set (`Button`, `Card`, `Badge`, `Modal`, `Stack`, `EmptyState`) over rolling new styled-components.
- **React:** Functional + hooks only. React Router v7 with `<BrowserRouter>`. Use the shared axios singleton `client/src/utils/api.js` (handles credentials + 401 toast + i18n).
- **Backend:** Express 5 async handlers + central error middleware (end of `server/index.js`). Validation via `express-validator`. **Never** `console.log` in routes — use `require('./utils/logger')` (pino).
- **Errors:** Wrap 5xx response messages in `safeError('prefix', err)` from `utils/safeError.js` (redacts details in prod). Import as `const safeError = require('../utils/safeError')` — it's a default export.
- **Origin / sanitizer middleware:** POST/PUT/PATCH/DELETE require an allowed `Origin` or `Referer`. supertest tests must `.set('Origin', 'http://localhost:5173')`. The NoSQL sanitizer strips `$`-prefixed and dotted keys from body/params/query.
- **i18n:** Every user-visible string goes through `t('namespace.key')`. Add the key to all four locale bundles (`en`, `ko`, `ru`, `es`) under `client/src/i18n/locales/<lang>/common.json`.

---

## 4. Branch + commit conventions

- **Branches:** `fix/issue-<NN>-short-slug`, `feat/...`, `chore/...`, `docs/...`.
- **Commits:** Imperative mood. Conventional-style prefixes (`fix(security):`, `chore(ci):`, `docs:`) — see recent `git log` for examples.
- **One PR per issue** where practical, with a `closes #N` footer so the issue auto-closes on merge.

## 5. Pull requests

Use the PR template (auto-populated). At minimum:

- Summary of what changed and why
- Test plan (commands you ran + results)
- Link to the issue this closes
- Screenshots if any visible UI changed

## 6. Reporting bugs / requesting features

Open an issue using the relevant template under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

---

Questions? Skim [CLAUDE.md](./CLAUDE.md) first (it's verbose but complete), then open a discussion if you're still stuck.
