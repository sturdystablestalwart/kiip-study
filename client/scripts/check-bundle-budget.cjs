#!/usr/bin/env node
/**
 * Issue #193 — fail the build if production JS exceeds the documented
 * size budget so a stray `import` of a heavy dep can't ship silently.
 *
 * Strategy: rather than one fragile "index.js < N bytes" check, we
 * track three budgets that map to real user-facing performance gates:
 *
 *   - entry chunk (index-*.js + vendor-*.js) — what every visitor pays
 *     for the very first route-render.  This is the budget that affects
 *     LCP / TTI for new visitors and should be the strictest.
 *   - lazy chunks total — sum of all the route-level lazy chunks.  Grows
 *     when we add features but each one only loads on demand.
 *   - "asymmetric" anychart chunk — pre-tracked separately because it's
 *     the known elephant (#6).  Budget set right at current size so any
 *     accidental re-import path bloats it further and fails the build.
 *
 * Override: re-run with `BUNDLE_BUDGET_OK=1` (set via PR label
 * `bundle-size-ok` → workflow exports the env var) to bypass — intended
 * only for deliberate, reviewed regressions.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist', 'assets');

// Budgets are in bytes.  Numbers below are derived from the current
// production build with ~10% headroom; tighten when AnyChart is solved (#6).
const BUDGETS = {
    // Every visitor downloads this on first paint.
    entry: { match: /^(index|vendor)-[A-Za-z0-9_-]+\.js$/, limit: 400_000 },
    // The chart library — guarded separately because it dominates total.
    anychart: { match: /^anychart-[A-Za-z0-9_-]+\.js$/, limit: 2_700_000 },
    // Everything else (route-level lazy chunks, i18n bundles, etc).
    lazy: { match: /\.js$/, limit: 600_000 },
};

if (process.env.BUNDLE_BUDGET_OK === '1') {
    console.log('BUNDLE_BUDGET_OK=1 set — skipping bundle-size budget check.');
    process.exit(0);
}

if (!fs.existsSync(DIST)) {
    console.error(`No build output at ${DIST}.  Run \`npm run build\` first.`);
    process.exit(2);
}

const files = fs.readdirSync(DIST)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, bytes: fs.statSync(path.join(DIST, f)).size }));

const buckets = { entry: [], anychart: [], lazy: [] };
for (const f of files) {
    if (BUDGETS.entry.match.test(f.name)) buckets.entry.push(f);
    else if (BUDGETS.anychart.match.test(f.name)) buckets.anychart.push(f);
    else buckets.lazy.push(f);
}

let failed = false;
for (const [bucket, files] of Object.entries(buckets)) {
    const total = files.reduce((a, f) => a + f.bytes, 0);
    const limit = BUDGETS[bucket].limit;
    const status = total > limit ? 'OVER' : 'ok  ';
    console.log(`[${status}] ${bucket.padEnd(8)} ${total.toLocaleString().padStart(11)}B / ${limit.toLocaleString()}B`);
    if (total > limit) {
        failed = true;
        console.log(`::error::Bundle bucket "${bucket}" is ${total} bytes (limit ${limit}).  ` +
            `If this is an intentional regression, add the \`bundle-size-ok\` PR label.`);
        for (const f of files.sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
            console.log(`         ${f.name}: ${f.bytes.toLocaleString()}B`);
        }
    }
}

process.exit(failed ? 1 : 0);
