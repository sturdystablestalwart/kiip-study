# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the High and Medium findings from the 2026-04-17 full-system audit (see `c:/kiip_audit_ws/results/phase3_audit_report_final.md`), bringing KIIP Study to ship-with-conditions readiness in ~1 week.

**Architecture:** Minimal targeted code changes on the Express 5 / Mongoose 9 backend plus Docker/ops hardening. No frontend rewrites; no architectural restructuring. Each PR is self-contained with tests.

**Tech Stack:** Express 5, Mongoose 9, Vitest (server unit tests), Playwright (E2E), jsonwebtoken, helmet, express-rate-limit, pino (new), styled-components 6 (decision pending), Docker Compose.

---

## Corrections From Audit

During plan preparation, two audit findings were re-verified and corrected:

- **H-SEC-3 Mass-assignment — FALSE POSITIVE.** `server/routes/admin.js:333` (`const { title, category, description, level, unit, questions } = req.body`) and `server/routes/sessions.js:67` (`const { answers, currentQuestion, remainingTime } = req.body`) already use destructuring, which IS the allowlist pattern. Unknown fields are silently ignored. **No change needed.**
- **H-SEC-1 share.js IDOR fix** — simplified. The Test model has no `createdBy` field (tests are admin-curated per CLAUDE.md product principle). The correct fix is `requireAdmin` on the share route, not an ownership check.

Net: **4 Highs remaining** to remediate (not 5).

---

## Decisions Needed From You Before Starting

These are embedded inline in the tasks with a recommendation; please confirm or override before PR 1 starts:

1. **CSRF defense-in-depth design** (M-SEC-1) — recommendation: **Origin/Referer header check middleware** (cheap, no token plumbing, works behind Caddy since Caddy preserves Origin). Alternative: `csurf`-style double-submit cookie token (~100 LOC, breaks easy cURL testing). Default: Origin/Referer check.

2. **styled-components 6.3 → 6.4 upgrade** (M-SEC-2) — recommendation: **defer** to a separate PR after remediation week. 6.4 changed subcomponent style APIs; needs its own regression pass against all pages. CSP `unsafe-inline` stays for now with a TODO.

3. **Structured logger choice** (M-SEC-5) — recommendation: **`pino`** (~100KB, battle-tested, fast). Alternative: console.log with NODE_ENV gating (0-cost). Default: pino.

4. **Backup strategy** (M-PROD-2) — recommendation: **mongodump to `./backups/` volume + daily cron inside a new `backup` compose service**, rotated weekly. Alternative: external managed (Atlas backups, AWS Backup). Default: local mongodump since this is a home-server deploy.

5. **`trust proxy` value** (M-PROD-3) — recommendation: **`app.set('trust proxy', 1)`** (one hop through Caddy). Verify with `curl -H "X-Forwarded-For: 1.2.3.4"` against deployed app.

---

## File Structure

Files created or modified, grouped by PR:

**PR 1 — Quick security logic fixes**
- Modify: `server/routes/share.js` — add `requireAdmin` to POST /:id/share
- Test: `server/routes/__tests__/share.test.js` — new

**PR 2 — LLM output validation**
- Create: `server/utils/llmValidator.js` — new validateLLMOutput()
- Modify: `server/utils/llm.js` — call validator before return
- Test: `server/utils/__tests__/llmValidator.test.js` — new

**PR 3 — Error handling & stability**
- Modify: `server/routes/stats.js` — try/catch both handlers
- Modify: `server/middleware/auth.js` — clockTolerance
- Modify: `server/index.js` — SIGTERM/SIGINT graceful shutdown
- Test: `server/routes/__tests__/stats.test.js` — new; extend `server/middleware/__tests__/auth.test.js`

**PR 4 — Performance + proxy correctness**
- Modify: `server/models/Test.js` — compound pagination index
- Modify: `server/index.js` — `app.set('trust proxy', 1)`

**PR 5 — Log hygiene & pino**
- Modify: `server/utils/magicLinkEmail.js` — remove token-leaking console.log
- Create: `server/utils/logger.js` — pino wrapper
- Modify: `server/index.js`, all routes with `console.error` — swap to logger
- Add: `server/package.json` — pino dependency

**PR 6 — CSRF defense-in-depth + NoSQL fuzz**
- Create: `server/middleware/originCheck.js` — Origin/Referer middleware
- Modify: `server/index.js` — apply originCheck to state-changing routes
- Test: `server/middleware/__tests__/originCheck.test.js` — new
- Create: `server/middleware/__tests__/sanitizer.test.js` — adversarial payload fuzz
- Modify: `server/routes/bulkImport.js` — TTL cleanup on temp files

**PR 7 — Docker hardening + backup + npm audit**
- Modify: `server/Dockerfile`, `client/Dockerfile` — USER directive, SHA-pinned bases
- Modify: `docker-compose.yaml` — user, read_only, resource limits, backup service
- Create: `ops/backup.sh` — mongodump script
- Modify: `.env.example` — add NODE_ENV
- Create: `ops/RUNBOOK.md` — backup/restore procedures (optional but recommended)

---

## PR 1: Quick Security Logic Fixes

**Scope:** H-SEC-1 (share IDOR). Smallest, highest-impact fix. Under 30 minutes.

### Task 1.1: Protect POST /api/tests/:id/share with requireAdmin

**Files:**
- Modify: `server/routes/share.js:17`
- Test: `server/routes/__tests__/share.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `server/routes/__tests__/share.test.js`:

```javascript
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongo;
let User;
let Test;

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';
    process.env.NODE_ENV = 'test';
    await mongoose.connect(process.env.MONGO_URI);
    User = require('../../models/User');
    Test = require('../../models/Test');
    app = require('../../index');
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
});

afterEach(async () => {
    await User.deleteMany({});
    await Test.deleteMany({});
});

const makeToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET, {
        issuer: 'kiip-study', audience: 'kiip-study-api', expiresIn: '1h',
    });

describe('POST /api/tests/:id/share', () => {
    test('non-admin user gets 403', async () => {
        const user = await User.create({ email: 'u@x.com', isAdmin: false });
        const test = await Test.create({ title: 'T', questions: [{ text: 'q', options: [{ text: 'a', isCorrect: true }] }] });
        const token = makeToken(user._id);

        const res = await request(app)
            .post(`/api/tests/${test._id}/share`)
            .set('Cookie', [`jwt=${token}`]);

        expect(res.status).toBe(403);
    });

    test('admin user gets shareUrl', async () => {
        const admin = await User.create({ email: 'a@x.com', isAdmin: true });
        const test = await Test.create({ title: 'T', questions: [{ text: 'q', options: [{ text: 'a', isCorrect: true }] }] });
        const token = makeToken(admin._id);

        const res = await request(app)
            .post(`/api/tests/${test._id}/share`)
            .set('Cookie', [`jwt=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body.shareId).toBeDefined();
        expect(res.body.shareUrl).toContain(res.body.shareId);
    });

    test('unauthenticated gets 401', async () => {
        const test = await Test.create({ title: 'T', questions: [{ text: 'q', options: [{ text: 'a', isCorrect: true }] }] });
        const res = await request(app).post(`/api/tests/${test._id}/share`);
        expect(res.status).toBe(401);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run routes/__tests__/share.test.js
```
Expected: the "non-admin user gets 403" test FAILS (current code returns 200).

- [ ] **Step 3: Add `requireAdmin` to the route**

Edit `server/routes/share.js`:

```javascript
const { requireAuth, requireAdmin } = require('../middleware/auth');
```

Change line 17 from:

```javascript
router.post('/:id/share', requireAuth, async (req, res) => {
```

to:

```javascript
router.post('/:id/share', requireAuth, requireAdmin, async (req, res) => {
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx vitest run routes/__tests__/share.test.js
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full server test suite to confirm no regression**

```bash
cd server && npx vitest run
```
Expected: 118 + 3 = 121 tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/routes/share.js server/routes/__tests__/share.test.js
git commit -m "fix(security): require admin role for test share link generation (H-SEC-1)"
```

---

## PR 2: LLM Output Validation (H-SEC-2)

**Scope:** Add a validator between `JSON.parse` of Gemini output and persistence. Rejects oversized/typed-wrong/HTML-tainted content. ~40 LOC + tests.

### Task 2.1: Create validateLLMOutput utility

**Files:**
- Create: `server/utils/llmValidator.js`
- Test: `server/utils/__tests__/llmValidator.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/utils/__tests__/llmValidator.test.js`:

```javascript
const { describe, test, expect } = require('vitest');
const { validateLLMOutput } = require('../llmValidator');

const validQuestion = {
    text: 'What is 한국?',
    options: [
        { text: 'Korea', isCorrect: true },
        { text: 'China', isCorrect: false },
        { text: 'Japan', isCorrect: false },
        { text: 'Vietnam', isCorrect: false },
    ],
    explanation: '한국 means Korea',
    type: 'mcq-single',
};

const makeValid = () => ({
    title: 'Sample Test',
    questions: [validQuestion],
});

describe('validateLLMOutput', () => {
    test('accepts valid output', () => {
        expect(() => validateLLMOutput(makeValid())).not.toThrow();
    });

    test('rejects missing title', () => {
        const bad = makeValid();
        delete bad.title;
        expect(() => validateLLMOutput(bad)).toThrow(/title/i);
    });

    test('rejects title over 200 chars', () => {
        const bad = makeValid();
        bad.title = 'x'.repeat(201);
        expect(() => validateLLMOutput(bad)).toThrow(/title/i);
    });

    test('rejects non-array questions', () => {
        const bad = makeValid();
        bad.questions = 'not an array';
        expect(() => validateLLMOutput(bad)).toThrow(/questions/i);
    });

    test('rejects empty questions', () => {
        const bad = makeValid();
        bad.questions = [];
        expect(() => validateLLMOutput(bad)).toThrow(/questions/i);
    });

    test('rejects question text over 2000 chars', () => {
        const bad = makeValid();
        bad.questions[0].text = 'x'.repeat(2001);
        expect(() => validateLLMOutput(bad)).toThrow(/text/i);
    });

    test('rejects explanation over 5000 chars', () => {
        const bad = makeValid();
        bad.questions[0].explanation = 'x'.repeat(5001);
        expect(() => validateLLMOutput(bad)).toThrow(/explanation/i);
    });

    test('rejects HTML tags in question text', () => {
        const bad = makeValid();
        bad.questions[0].text = 'hello <script>alert(1)</script>';
        expect(() => validateLLMOutput(bad)).toThrow(/html/i);
    });

    test('rejects HTML tags in explanation', () => {
        const bad = makeValid();
        bad.questions[0].explanation = '<img src=x onerror=alert(1)>';
        expect(() => validateLLMOutput(bad)).toThrow(/html/i);
    });

    test('rejects options[].text over 500 chars', () => {
        const bad = makeValid();
        bad.questions[0].options[0].text = 'x'.repeat(501);
        expect(() => validateLLMOutput(bad)).toThrow(/option/i);
    });

    test('rejects non-boolean isCorrect', () => {
        const bad = makeValid();
        bad.questions[0].options[0].isCorrect = 'true';
        expect(() => validateLLMOutput(bad)).toThrow(/isCorrect/i);
    });

    test('rejects more than 50 questions', () => {
        const bad = makeValid();
        bad.questions = Array.from({ length: 51 }, () => ({ ...validQuestion }));
        expect(() => validateLLMOutput(bad)).toThrow(/too many/i);
    });

    test('rejects unknown question type', () => {
        const bad = makeValid();
        bad.questions[0].type = 'true-false';
        expect(() => validateLLMOutput(bad)).toThrow(/type/i);
    });

    test('accepts all 5 supported question types', () => {
        const types = ['mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank'];
        for (const t of types) {
            const v = makeValid();
            v.questions[0].type = t;
            expect(() => validateLLMOutput(v)).not.toThrow();
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run utils/__tests__/llmValidator.test.js
```
Expected: all tests FAIL ("Cannot find module '../llmValidator'").

- [ ] **Step 3: Create `server/utils/llmValidator.js`**

```javascript
const ALLOWED_TYPES = new Set([
    'mcq-single', 'mcq-multiple', 'short-answer', 'ordering', 'fill-in-the-blank',
]);

const HTML_PATTERN = /<\/?[a-z][\s\S]*?>/i;

const MAX = {
    title: 200,
    questionText: 2000,
    optionText: 500,
    explanation: 5000,
    questionCount: 50,
    optionCount: 10,
};

function assert(cond, msg) {
    if (!cond) throw new Error(`LLM output validation failed: ${msg}`);
}

function isSafeString(value, max, label) {
    assert(typeof value === 'string', `${label} must be a string`);
    assert(value.length > 0, `${label} must not be empty`);
    assert(value.length <= max, `${label} exceeds max length ${max}`);
    assert(!HTML_PATTERN.test(value), `${label} must not contain HTML tags`);
}

function validateOption(opt, idx, qIdx) {
    assert(opt && typeof opt === 'object', `options[${idx}] of question[${qIdx}] must be an object`);
    isSafeString(opt.text, MAX.optionText, `question[${qIdx}].options[${idx}].text`);
    assert(typeof opt.isCorrect === 'boolean', `question[${qIdx}].options[${idx}].isCorrect must be boolean`);
}

function validateQuestion(q, idx) {
    assert(q && typeof q === 'object', `question[${idx}] must be an object`);
    isSafeString(q.text, MAX.questionText, `question[${idx}].text`);
    assert(ALLOWED_TYPES.has(q.type || 'mcq-single'), `question[${idx}].type must be one of: ${[...ALLOWED_TYPES].join(', ')}`);

    if (q.explanation !== undefined && q.explanation !== null && q.explanation !== '') {
        isSafeString(q.explanation, MAX.explanation, `question[${idx}].explanation`);
    }

    assert(Array.isArray(q.options), `question[${idx}].options must be an array`);
    assert(q.options.length <= MAX.optionCount, `question[${idx}] has too many options (max ${MAX.optionCount})`);
    q.options.forEach((opt, oIdx) => validateOption(opt, oIdx, idx));

    if (q.image !== undefined && q.image !== null && q.image !== '') {
        assert(typeof q.image === 'string' && q.image.length <= 200, `question[${idx}].image must be a short string`);
    }
}

function validateLLMOutput(parsed) {
    assert(parsed && typeof parsed === 'object', 'output must be an object');
    isSafeString(parsed.title, MAX.title, 'title');

    assert(Array.isArray(parsed.questions), 'questions must be an array');
    assert(parsed.questions.length > 0, 'questions must not be empty');
    assert(parsed.questions.length <= MAX.questionCount, `too many questions (max ${MAX.questionCount})`);

    parsed.questions.forEach((q, idx) => validateQuestion(q, idx));

    return parsed;
}

module.exports = { validateLLMOutput };
```

- [ ] **Step 4: Run test to verify all pass**

```bash
cd server && npx vitest run utils/__tests__/llmValidator.test.js
```
Expected: 14 tests PASS.

- [ ] **Step 5: Integrate validator into llm.js**

Edit `server/utils/llm.js` — add import at top and call validator after parse. Change:

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
```

to:

```javascript
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { validateLLMOutput } = require('./llmValidator');
```

Replace lines 52-57 (the `const parsed = JSON.parse(jsonText); ... if (!parsed.questions || parsed.questions.length === 0)` block) with:

```javascript
        const parsed = JSON.parse(jsonText);
        validateLLMOutput(parsed);
        return parsed;
```

- [ ] **Step 6: Run server tests to confirm no regression**

```bash
cd server && npx vitest run
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/utils/llmValidator.js server/utils/__tests__/llmValidator.test.js server/utils/llm.js
git commit -m "fix(security): validate LLM output before persist (H-SEC-2)"
```

---

## PR 3: Error Handling & Stability

**Scope:** H-STAB-1 (stats.js try/catch), M-SEC-6 (JWT clockTolerance), M-OPS-1 (graceful shutdown). All small, independent changes; bundled for atomic review.

### Task 3.1: Wrap stats.js handlers in try/catch with safeError

**Files:**
- Modify: `server/routes/stats.js`
- Test: `server/routes/__tests__/stats.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `server/routes/__tests__/stats.test.js`:

```javascript
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app, mongo, User;

beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';
    process.env.NODE_ENV = 'test';
    await mongoose.connect(process.env.MONGO_URI);
    User = require('../../models/User');
    app = require('../../index');
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
});

afterEach(async () => {
    await User.deleteMany({});
});

const makeToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET, {
        issuer: 'kiip-study', audience: 'kiip-study-api', expiresIn: '1h',
    });

describe('GET /api/stats error handling', () => {
    test('handler failure returns clean 500, no stack leak', async () => {
        const user = await User.create({ email: 'u@x.com' });
        const token = makeToken(user._id);

        // Force Attempt.aggregate to throw by temporarily hijacking it
        const Attempt = require('../../models/Attempt');
        const orig = Attempt.aggregate;
        Attempt.aggregate = () => { throw new Error('forced aggregation failure'); };

        try {
            const res = await request(app)
                .get('/api/stats?period=7d')
                .set('Cookie', [`jwt=${token}`]);

            expect(res.status).toBe(500);
            expect(res.body.message).toBeDefined();
            expect(res.body.stack).toBeUndefined();
            expect(JSON.stringify(res.body)).not.toContain('forced aggregation failure');
        } finally {
            Attempt.aggregate = orig;
        }
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run routes/__tests__/stats.test.js
```
Expected: test fails because current code lets the default Express error handler leak the internal message.

- [ ] **Step 3: Wrap both stats.js handlers**

Edit `server/routes/stats.js`. At top, add:

```javascript
const { safeError } = require('../utils/safeError');
```

Wrap the GET `/` handler (lines 8-114). Change:

```javascript
router.get('/', requireAuth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    // ... body ...
    res.json({ kpis, trend, unitBreakdown });
});
```

to:

```javascript
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id);
        // ... existing body ...
        res.json({ kpis, trend, unitBreakdown });
    } catch (err) {
        res.status(500).json({ message: safeError('Failed to load stats', err) });
    }
});
```

Apply same try/catch pattern to the GET `/question-types` handler (lines 118-154), with message `'Failed to load question-type stats'`.

- [ ] **Step 4: Run test to verify pass**

```bash
cd server && npx vitest run routes/__tests__/stats.test.js
```
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add server/routes/stats.js server/routes/__tests__/stats.test.js
git commit -m "fix(stability): wrap stats.js handlers with safeError (H-STAB-1)"
```

### Task 3.2: Add clockTolerance to JWT verify

**Files:**
- Modify: `server/middleware/auth.js:17`
- Test: extend `server/middleware/__tests__/auth.test.js`

- [ ] **Step 1: Add test**

Append to `server/middleware/__tests__/auth.test.js`:

```javascript
test('tolerates ≤10s clock skew between token issue and verify', async () => {
    // Token issued 5s in the future (client clock ahead)
    const futureIat = Math.floor(Date.now() / 1000) + 5;
    const token = jwt.sign(
        { userId: 'abc', iat: futureIat },
        process.env.JWT_SECRET,
        { issuer: 'kiip-study', audience: 'kiip-study-api', algorithm: 'HS256', noTimestamp: true }
    );
    // manually rebuild payload with explicit iat
    const tokenWithIat = jwt.sign(
        { userId: 'abc' },
        process.env.JWT_SECRET,
        { issuer: 'kiip-study', audience: 'kiip-study-api', algorithm: 'HS256', expiresIn: '1h', notBefore: -5 }
    );
    // Verify should succeed with clockTolerance:10
    expect(() => jwt.verify(tokenWithIat, process.env.JWT_SECRET, {
        issuer: 'kiip-study', audience: 'kiip-study-api', algorithms: ['HS256'], clockTolerance: 10,
    })).not.toThrow();
});
```

- [ ] **Step 2: Modify auth.js:17**

Change:

```javascript
const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'kiip-study', audience: 'kiip-study-api', algorithms: ['HS256'] });
```

to:

```javascript
const decoded = jwt.verify(token, JWT_SECRET, {
    issuer: 'kiip-study',
    audience: 'kiip-study-api',
    algorithms: ['HS256'],
    clockTolerance: 10, // seconds
});
```

- [ ] **Step 3: Verify**

```bash
cd server && npx vitest run middleware/__tests__/auth.test.js
```
Expected: pass.

### Task 3.3: Add SIGTERM/SIGINT graceful shutdown

**Files:**
- Modify: `server/index.js` (end of file)

- [ ] **Step 1: Append graceful-shutdown block after `app.listen(...)`**

At the bottom of `server/index.js`, replace:

```javascript
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

with:

```javascript
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    const forced = setTimeout(() => {
        console.error('Forced shutdown after 30s timeout');
        process.exit(1);
    }, 30000);
    server.close(async () => {
        try { await mongoose.connection.close(); } catch (e) { /* ignore */ }
        clearTimeout(forced);
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 2: Manual verification (no unit test — process-level)**

In one terminal: `cd server && node index.js`. In another: `kill -TERM <pid>`. Expect log line "SIGTERM received..." and clean exit 0 within a second. Then repeat for SIGINT (Ctrl-C).

- [ ] **Step 3: Run full suite**

```bash
cd server && npx vitest run
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add server/middleware/auth.js server/middleware/__tests__/auth.test.js server/index.js
git commit -m "fix(stability): jwt clockTolerance + graceful shutdown (M-SEC-6, M-OPS-1)"
```

---

## PR 4: Performance + Proxy Correctness

**Scope:** H-PERF-1 (compound index) and M-PROD-3 (`trust proxy`). 2-line PR.

### Task 4.1: Add compound pagination index on Test

**Files:**
- Modify: `server/models/Test.js:36` (add one index line)

- [ ] **Step 1: Edit `server/models/Test.js`**

After line 36 (`TestSchema.index({ level: 1, unit: 1, createdAt: -1 });`), add:

```javascript
// Compound index for cursor pagination by (createdAt desc, _id desc)
TestSchema.index({ createdAt: -1, _id: -1 });
```

- [ ] **Step 2: Verify via restart — Mongoose auto-syncs indexes**

Restart the server (or run a test that inserts and queries Test), then in mongo shell:

```javascript
db.tests.getIndexes()
```
Expected: includes `{ createdAt: -1, _id: -1 }` entry.

### Task 4.2: Configure trust proxy

**Files:**
- Modify: `server/index.js` (after `const app = express();`)

- [ ] **Step 1: Add `app.set('trust proxy', 1)` after app init**

Find the line `const app = express();` near the top of `server/index.js`. On the next line, add:

```javascript
app.set('trust proxy', 1); // Trust 1 proxy hop (Caddy)
```

- [ ] **Step 2: Verify rate-limit keying works**

Start server locally, then:

```bash
curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:5000/api/health
```

In a follow-up PR or manual check, confirm `req.ip === '1.2.3.4'` is used as the rate-limit key (by spamming and seeing per-forwarded-for exhaustion). This is an integration check; no unit test added.

- [ ] **Step 3: Commit**

```bash
git add server/models/Test.js server/index.js
git commit -m "perf+ops: compound pagination index + trust proxy (H-PERF-1, M-PROD-3)"
```

---

## PR 5: Log Hygiene & Structured Logging

**Scope:** M-SEC-5 (console.* purge + magic-link token-leak fix). Introduces pino.

### Task 5.1: Fix magic-link token console leak

**Files:**
- Modify: `server/utils/magicLinkEmail.js:69-72`

- [ ] **Step 1: Read current implementation**

```bash
cat server/utils/magicLinkEmail.js
```

- [ ] **Step 2: Replace fallback console.log with sanitized version**

Edit lines 69-72. Replace the block that currently logs the full magic-link URL with:

```javascript
    console.warn('[magic-link] SMTP not configured — email NOT sent. Check SMTP_USER/SMTP_PASS/SMTP_FROM env vars.');
    return { sent: false, reason: 'smtp-not-configured' };
```

Do NOT log token or verifyUrl anywhere in this function.

- [ ] **Step 3: Add test that ensures no token leaks in logs**

Extend `server/utils/__tests__/magicLinkEmail.test.js` with:

```javascript
test('does not log token or verifyUrl when SMTP missing', async () => {
    const logs = [];
    const origWarn = console.warn;
    console.warn = (...args) => logs.push(args.join(' '));
    try {
        process.env.SMTP_USER = '';
        await sendMagicLinkEmail('u@x.com', 'SECRET_TOKEN_XYZ', 'http://host/verify?t=SECRET_TOKEN_XYZ', 'en');
        expect(logs.join('\n')).not.toContain('SECRET_TOKEN_XYZ');
    } finally {
        console.warn = origWarn;
    }
});
```

- [ ] **Step 4: Run**

```bash
cd server && npx vitest run utils/__tests__/magicLinkEmail.test.js
```
Expected: pass.

### Task 5.2: Add pino structured logger and swap console.error calls

**Files:**
- Create: `server/utils/logger.js`
- Modify: `server/package.json` (add pino)
- Modify: ~15 files using `console.error(...)` — swap to `logger.error(...)`

- [ ] **Step 1: Install pino**

```bash
cd server && npm install pino@9
```

- [ ] **Step 2: Create `server/utils/logger.js`**

```javascript
const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'token', 'jwt'],
        remove: true,
    },
    transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true },
    },
});

module.exports = logger;
```

- [ ] **Step 3: Install pino-pretty as dev dep (optional, for local readability)**

```bash
cd server && npm install --save-dev pino-pretty@11
```

- [ ] **Step 4: Swap `console.error` calls in server/**

For each of these files, replace `console.error(...)` with `logger.error(...)` after adding `const logger = require('<relative>/utils/logger');` at top:

- `server/index.js`
- `server/routes/admin.js`
- `server/routes/auth.js`
- `server/routes/share.js`
- `server/routes/stats.js`
- `server/routes/pdf.js`
- `server/routes/tests.js`
- `server/routes/bulkImport.js`
- `server/routes/sessions.js`
- `server/routes/flags.js`
- `server/utils/autoImporter.js`
- `server/utils/llm.js`
- `server/utils/magicLinkEmail.js`

Do this one file at a time. Example for `server/routes/admin.js` line 154:

Before:
```javascript
console.error("Text Generation Error:", err);
```

After:
```javascript
logger.error({ err }, 'Text generation error');
```

Pino takes `(obj, msg)` for structured logs. For simple strings: `logger.error('message')`.

- [ ] **Step 5: Keep `console.log` only for startup banners**

Leave `console.log(...)` in `server/index.js` shutdown/startup banners untouched (they're process-lifecycle logs, not routine request logs).

- [ ] **Step 6: Run suite**

```bash
cd server && npx vitest run
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/utils/logger.js server/utils/magicLinkEmail.js server/utils/__tests__/magicLinkEmail.test.js server/index.js server/routes server/utils/llm.js server/utils/autoImporter.js
git commit -m "refactor(ops): structured logging via pino + purge token-leaking console.log (M-SEC-5)"
```

---

## PR 6: CSRF Defense-in-Depth + NoSQL Fuzz Tests + Bulk-Import TTL

**Scope:** M-SEC-1 (Origin/Referer middleware), M-SEC-3 (adversarial sanitizer tests), M-SEC-4 (bulk-import TTL). Bundled because all touch middleware + need fixture tests.

### Task 6.1: Create Origin/Referer check middleware

**Files:**
- Create: `server/middleware/originCheck.js`
- Create: `server/middleware/__tests__/originCheck.test.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write failing test**

Create `server/middleware/__tests__/originCheck.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const { createOriginCheck } = require('../originCheck');

const makeApp = (origins) => {
    const app = express();
    app.use(createOriginCheck(origins));
    app.post('/test', (req, res) => res.json({ ok: true }));
    app.get('/test', (req, res) => res.json({ ok: true }));
    return app;
};

describe('originCheck middleware', () => {
    const allowed = ['http://localhost:5173', 'https://kiip.example.com'];

    test('POST with allowed Origin succeeds', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Origin', 'http://localhost:5173');
        expect(res.status).toBe(200);
    });

    test('POST with disallowed Origin returns 403', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Origin', 'https://evil.com');
        expect(res.status).toBe(403);
    });

    test('POST with no Origin falls back to Referer', async () => {
        const res = await request(makeApp(allowed))
            .post('/test')
            .set('Referer', 'http://localhost:5173/login');
        expect(res.status).toBe(200);
    });

    test('POST with no Origin and no Referer returns 403', async () => {
        const res = await request(makeApp(allowed)).post('/test');
        expect(res.status).toBe(403);
    });

    test('GET is not checked (safe method)', async () => {
        const res = await request(makeApp(allowed))
            .get('/test')
            .set('Origin', 'https://evil.com');
        expect(res.status).toBe(200);
    });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd server && npx vitest run middleware/__tests__/originCheck.test.js
```
Expected: module-not-found failure.

- [ ] **Step 3: Create `server/middleware/originCheck.js`**

```javascript
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function createOriginCheck(allowedOrigins) {
    const allowed = new Set(allowedOrigins.map(o => o.toLowerCase()));

    return (req, res, next) => {
        if (!UNSAFE_METHODS.has(req.method)) return next();

        const origin = (req.headers.origin || '').toLowerCase();
        if (origin && allowed.has(origin)) return next();

        const referer = req.headers.referer || '';
        if (referer) {
            try {
                const refOrigin = new URL(referer).origin.toLowerCase();
                if (allowed.has(refOrigin)) return next();
            } catch { /* bad URL */ }
        }

        return res.status(403).json({ message: 'Origin not allowed' });
    };
}

module.exports = { createOriginCheck };
```

- [ ] **Step 4: Run to verify tests pass**

```bash
cd server && npx vitest run middleware/__tests__/originCheck.test.js
```
Expected: 5 tests pass.

- [ ] **Step 5: Wire into `server/index.js`**

Find the ALLOWED_ORIGINS definition near the CORS block. Import and apply middleware AFTER CORS and cookie parsing but BEFORE routes:

```javascript
const { createOriginCheck } = require('./middleware/originCheck');
// ... (after CORS + cookieParser) ...
app.use('/api', createOriginCheck(ALLOWED_ORIGINS));
```

- [ ] **Step 6: Verify no regression**

```bash
cd server && npx vitest run
```
Expected: all pass. Note: existing share.test.js uses `set('Cookie',...)` without Origin — the test suite uses supertest which defaults Origin to nothing; **the test for "admin gets shareUrl" may now fail with 403**. Fix by adding `.set('Origin', 'http://localhost:5173')` or similar to supertest calls in existing tests (PR 1 + PR 3 test files).

- [ ] **Step 7: Update test fixtures with Origin header**

In `server/routes/__tests__/share.test.js`, `server/routes/__tests__/stats.test.js`, and any other POST/PATCH test, add `.set('Origin', 'http://localhost:5173')` to each request. Re-run full suite.

### Task 6.2: Adversarial NoSQL sanitizer fuzz

**Files:**
- Create: `server/middleware/__tests__/sanitizer.test.js`

- [ ] **Step 1: Write fuzz tests against the sanitizer in `server/index.js`**

The sanitizer is defined inline in `server/index.js:64-107`. To test it in isolation, refactor it into `server/middleware/sanitizer.js` first:

Extract lines 64-107 to `server/middleware/sanitizer.js`:

```javascript
const MONGO_OPS = new Set([
    '$where', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$regex',
    '$exists', '$type', '$expr', '$jsonSchema', '$mod', '$text', '$geoIntersects',
    '$geoWithin', '$near', '$nearSphere', '$all', '$elemMatch', '$size',
    '$bitsAllClear', '$bitsAllSet', '$bitsAnyClear', '$bitsAnySet',
    '$rand', '$natural', '$comment', '$eq'
]);

function sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) { obj.forEach(sanitize); return obj; }

    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
            continue;
        }
        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            for (const innerKey of Object.keys(val)) {
                if (innerKey.startsWith('$') || MONGO_OPS.has(innerKey)) {
                    delete obj[key];
                    break;
                }
            }
            sanitize(val);
        } else if (Array.isArray(val)) {
            sanitize(val);
        }
    }
    return obj;
}

function sanitizeMiddleware(req, _res, next) {
    sanitize(req.body);
    sanitize(req.query);
    sanitize(req.params);
    next();
}

module.exports = { sanitize, sanitizeMiddleware };
```

Replace lines 64-107 in `server/index.js` with:

```javascript
const { sanitizeMiddleware } = require('./middleware/sanitizer');
app.use('/api', sanitizeMiddleware);
```

- [ ] **Step 2: Write test**

Create `server/middleware/__tests__/sanitizer.test.js`:

```javascript
const { sanitize } = require('../sanitizer');

describe('NoSQL sanitizer adversarial payloads', () => {
    test('strips top-level $operator keys', () => {
        const out = sanitize({ $where: 'evil', name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('strips dotted keys', () => {
        const out = sanitize({ 'a.b.c': 1, name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('removes object values containing $operator keys', () => {
        const out = sanitize({ filter: { $ne: null }, name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('cleans nested arrays of operator objects', () => {
        const out = sanitize({ answers: [{ $ne: 1 }, { text: 'ok' }] });
        expect(out.answers[0]).not.toHaveProperty('$ne');
        expect(out.answers[1]).toEqual({ text: 'ok' });
    });

    test('deeply nested operator inside valid value is stripped', () => {
        const out = sanitize({ a: { b: { $gt: '' } } });
        expect(out.a).not.toHaveProperty('b');
    });

    test('preserves valid nested objects', () => {
        const out = sanitize({ user: { name: 'a', prefs: { lang: 'ko' } } });
        expect(out).toEqual({ user: { name: 'a', prefs: { lang: 'ko' } } });
    });

    test('preserves arrays of strings', () => {
        const out = sanitize({ tags: ['a', 'b', 'c'] });
        expect(out).toEqual({ tags: ['a', 'b', 'c'] });
    });

    test('handles null, undefined, primitives safely', () => {
        expect(sanitize(null)).toBeNull();
        expect(sanitize(undefined)).toBeUndefined();
        expect(sanitize('string')).toBe('string');
        expect(sanitize(42)).toBe(42);
    });
});
```

- [ ] **Step 3: Run**

```bash
cd server && npx vitest run middleware/__tests__/sanitizer.test.js
```
Expected: all 8 pass. If any fail, the sanitizer has a bypass — file findings inline and fix them.

### Task 6.3: Bulk-import temp file TTL cleanup

**Files:**
- Modify: `server/routes/bulkImport.js` (add setInterval cleanup on module load)

- [ ] **Step 1: Append cleanup scheduler at bottom of bulkImport.js, just before `module.exports`**

```javascript
const fs = require('fs').promises;
const pathMod = require('path');

const TEMP_DIR = pathMod.join(__dirname, '../uploads/temp');
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function cleanupTempPreviews() {
    try {
        const entries = await fs.readdir(TEMP_DIR).catch(() => []);
        const now = Date.now();
        for (const name of entries) {
            if (!name.startsWith('preview-')) continue;
            const full = pathMod.join(TEMP_DIR, name);
            try {
                const stat = await fs.stat(full);
                if (now - stat.mtimeMs > MAX_AGE_MS) await fs.unlink(full);
            } catch { /* ignore */ }
        }
    } catch (err) {
        logger.warn({ err }, 'bulk-import temp cleanup failed');
    }
}

// Run on module load, then every 15 minutes
cleanupTempPreviews();
setInterval(cleanupTempPreviews, 15 * 60 * 1000).unref();
```

(Adjust `require` statements at top to include `fs` and `path` if not already there — they likely are.)

- [ ] **Step 2: Manual verification**

```bash
touch server/uploads/temp/preview-test.json
# Force mtime to 2 hours ago:
node -e "require('fs').utimesSync('server/uploads/temp/preview-test.json', new Date(Date.now()-7200000), new Date(Date.now()-7200000))"
# Start server (which loads bulkImport and runs cleanup)
# File should be gone
```

- [ ] **Step 3: Commit**

```bash
git add server/middleware/originCheck.js server/middleware/sanitizer.js server/middleware/__tests__/originCheck.test.js server/middleware/__tests__/sanitizer.test.js server/routes/bulkImport.js server/index.js server/routes/__tests__/share.test.js server/routes/__tests__/stats.test.js
git commit -m "security: origin-check middleware + sanitizer fuzz + bulk-import TTL (M-SEC-1/3/4)"
```

---

## PR 7: Docker Hardening, Backup, npm audit

**Scope:** M-PROD-1 (Docker), M-PROD-2 (backup), M-DEPS-1 (audit). Ops-focused. Can ship independently.

### Task 7.1: Run npm audit and document

- [ ] **Step 1: Run audit on both packages**

```bash
cd server && npm audit --production --audit-level=high 2>&1 | tee /tmp/server-audit.txt
cd ../client && npm audit --production --audit-level=high 2>&1 | tee /tmp/client-audit.txt
```

- [ ] **Step 2: For each High/Critical, decide: patch (npm audit fix), replace, or accept**

Check in particular:
- `axios` client version — if <1.13.2, upgrade via `npm install axios@^1.13.5` (or latest patch in 1.x).
- `string-similarity` — deprecated; note but defer replacement to its own PR (behavior change risk).

- [ ] **Step 3: Record decisions in `ops/AUDIT_2026-04-17.md`**

Create `ops/AUDIT_2026-04-17.md`:

```markdown
# npm audit — 2026-04-17

## Server
[paste output; for each finding: fix-plan or accepted-risk]

## Client
[paste output; for each finding: fix-plan or accepted-risk]

## Deferred
- string-similarity: deprecated but functional; plan replacement in Q2 2026 sprint.
```

### Task 7.2: Dockerfile USER directive + SHA pinning

**Files:**
- Modify: `server/Dockerfile`
- Modify: `client/Dockerfile`

- [ ] **Step 1: Edit `server/Dockerfile`**

Before the `CMD` line (at the bottom), insert:

```dockerfile
RUN chown -R node:node /app
USER node
```

Change the `FROM` line from:

```dockerfile
FROM node:20-alpine
```

to (with a pinned SHA — look up current digest):

```dockerfile
# Resolve current digest with: docker pull node:20-alpine && docker inspect --format='{{index .RepoDigests 0}}' node:20-alpine
FROM node:20-alpine@sha256:<LOOKUP_AND_INSERT>
```

- [ ] **Step 2: Same treatment for `client/Dockerfile`**

Apply USER and SHA-pin to both the builder and nginx stages.

- [ ] **Step 3: Rebuild and confirm running as non-root**

```bash
docker compose build server
docker compose run --rm server id
```
Expected: `uid=1000(node) gid=1000(node) groups=1000(node)`.

### Task 7.3: docker-compose resource limits + read_only

**Files:**
- Modify: `docker-compose.yaml`

- [ ] **Step 1: Add per-service resource limits and read_only flags**

For the `server` service, add:

```yaml
    read_only: true
    tmpfs:
      - /tmp
    mem_limit: 512m
    cpus: 1.0
```

For `mongo` service:

```yaml
    mem_limit: 1g
    cpus: 1.0
```

For `client` (nginx):

```yaml
    read_only: true
    tmpfs:
      - /var/cache/nginx
      - /var/run
    mem_limit: 128m
    cpus: 0.5
```

For `caddy`:

```yaml
    mem_limit: 128m
    cpus: 0.25
```

- [ ] **Step 2: Verify all services start**

```bash
docker compose down && docker compose up -d
docker compose ps
```
Expected: all services `running (healthy)` within 60s.

- [ ] **Step 3: Test upload path works** (it writes to /uploads volume, not rootfs — should succeed under read_only)

```bash
# Log in as admin via browser, upload an image via admin UI, verify file present
ls docker volumes ... server_uploads/images/
```

### Task 7.4: Backup service + script

**Files:**
- Create: `ops/backup.sh`
- Modify: `docker-compose.yaml` (add `backup` service)
- Create: `backups/.gitkeep` (+ .gitignore pattern)

- [ ] **Step 1: Create `ops/backup.sh`**

```bash
#!/usr/bin/env sh
set -e
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/backups/mongo-$TS
mkdir -p "$OUT"
mongodump --uri="$MONGO_URI" --out="$OUT"
tar czf "/backups/mongo-$TS.tar.gz" -C "$OUT" .
rm -rf "$OUT"

# Rotate: keep last 14 daily backups
ls -t /backups/mongo-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup complete: /backups/mongo-$TS.tar.gz"
```

```bash
chmod +x ops/backup.sh
```

- [ ] **Step 2: Append `backup` service to `docker-compose.yaml`**

```yaml
  backup:
    image: mongo:7
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      MONGO_URI: mongodb://mongo:27017/kiip_test_app
    volumes:
      - ./ops/backup.sh:/usr/local/bin/backup.sh:ro
      - ./backups:/backups
    entrypoint: ["/bin/sh", "-c"]
    command: >
      "while true; do sleep 86400; /usr/local/bin/backup.sh; done"
    restart: unless-stopped
    mem_limit: 256m
```

- [ ] **Step 3: Add `backups/` to `.gitignore`**

Append to `.gitignore`:

```
# Local backups
backups/*.tar.gz
backups/mongo-*/
```

Create `backups/.gitkeep` empty file so directory exists in repo.

- [ ] **Step 4: Test backup runs once manually**

```bash
docker compose run --rm backup /usr/local/bin/backup.sh
ls -la backups/
```
Expected: `mongo-*.tar.gz` file present.

- [ ] **Step 5: Test restore (dry run)**

```bash
cd backups && tar xzf mongo-*.tar.gz -C /tmp/restore-test
ls /tmp/restore-test/kiip_test_app/*.bson
```
Expected: BSON files for each collection.

- [ ] **Step 6: Document in `ops/RUNBOOK.md`**

Create `ops/RUNBOOK.md`:

```markdown
# KIIP Study Operations Runbook

## Backup
- Schedule: daily @ container uptime (every 86400s)
- Location: `./backups/mongo-<UTC-timestamp>.tar.gz`
- Rotation: last 14 backups kept

## Manual Backup
```sh
docker compose run --rm backup /usr/local/bin/backup.sh
```

## Restore
1. Stop app: `docker compose stop server client`
2. Extract backup: `tar xzf backups/mongo-<ts>.tar.gz -C /tmp/restore`
3. Restore:
   ```sh
   docker compose run --rm backup mongorestore --uri="mongodb://mongo:27017" --drop /tmp/restore
   ```
4. Restart: `docker compose up -d`

## Quarterly Drill
Restore last week's backup to a throwaway mongo instance and verify collections are present.
```

### Task 7.5: .env.example completeness

- [ ] **Step 1: Add missing env vars**

Edit `.env.example` and add:

```
# Required in production
NODE_ENV=development
LOG_LEVEL=info
```

- [ ] **Step 2: Verify no `process.env.*` in code is missing from example**

```bash
grep -rE "process\.env\.([A-Z_]+)" --include="*.js" server/ | grep -oE "process\.env\.[A-Z_]+" | sort -u
```

Compare the list to `.env.example`. Any new ones get added.

### Task 7.6: Commit PR 7

- [ ] **Step 1: Commit**

```bash
git add server/Dockerfile client/Dockerfile docker-compose.yaml ops/ backups/.gitkeep .gitignore .env.example
git commit -m "ops: docker hardening + backup service + npm audit baseline (M-PROD-1/2, M-DEPS-1)"
```

---

## Playwright Smoke Pass (after each PR)

After each PR, run:

```bash
npx playwright test --project chromium
```

If any test fails due to the change, fix the test fixture (likely adding `Origin` header in PR 6) and include the test fix in the same PR.

---

## Self-Review Checklist (run before final merge)

- [ ] All 4 remaining Highs have a dedicated task with test.
- [ ] All 10 Mediums have a dedicated task or explicit deferral note.
- [ ] No task uses "TODO" or placeholder code — every step has actual code.
- [ ] Function and file names are consistent across tasks (e.g., `validateLLMOutput`, `createOriginCheck`, `sanitize`).
- [ ] Test files match the test file naming pattern already in use (`__tests__/*.test.js`).
- [ ] No task changes UX-critical behavior without a Playwright regression pass.
- [ ] npm audit output is recorded and decisions documented.

## Deferred (post-remediation week)

- Upgrade styled-components 6.3 → 6.4 and implement CSP nonce (M-SEC-2). Own PR after regression tests pass.
- Replace `string-similarity` (deprecated) with a maintained alternative.
- Client bundle: dynamic import AnyChart (Low).
- A11y: timer `aria-live`, AuthModal/CommandPalette focus traps, hardcoded `#fff` in 2 files (Low).
- Playwright: add axe-core integration, replace 98 `waitForTimeout` calls with `waitFor(locator)`.
- Documented secret management migration to Docker Secrets / cloud secret manager.

---

## Timeline Estimate

| PR | Target day | Effort |
|----|-----------|--------|
| PR 1 — Share IDOR | Day 1 AM | 30 min |
| PR 2 — LLM validation | Day 1 PM | 2 hr |
| PR 3 — Error handling | Day 2 | 3 hr |
| PR 4 — Perf + trust proxy | Day 2 | 30 min |
| PR 5 — Log hygiene + pino | Day 3 | 4 hr |
| PR 6 — CSRF + fuzz + TTL | Day 4 | 4 hr |
| PR 7 — Docker + backup + audit | Day 5 | 4 hr |
| Playwright regression buffer | Day 6 | 3 hr |
| Polish / review buffer | Day 7 | 3 hr |

Total: ~24 engineering hours spread over 5-7 calendar days.
