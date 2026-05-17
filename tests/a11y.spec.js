// Issue #26 — automated accessibility audit for every top-level route
// that doesn't require a real test ID or authentication.  Runs on every
// PR via the existing Playwright e2e CI job.
//
// Scope choices:
//   - Anonymous routes only.  /dashboard, /admin, /endless, /test/:id,
//     /shared/:id all redirect to home or auth-gate, so scanning them
//     unauthenticated would just re-scan the home/login layer.  Auth-
//     gated route audits belong in a separate authenticated-flow spec
//     (out of scope for #26's "add automated audit" ask).
//   - WCAG 2 A + AA tags — matches existing 3 axe tests in app.spec.js
//     so the bar is consistent.
//   - Fail on `critical` + `serious` impact; allow `moderate` + `minor`
//     to surface in logs without failing CI (so a contrast tweak in a
//     style refresh doesn't immediately block unrelated PRs).
//
// Wired into the e2e CI shards via tests/ being picked up by the
// existing playwright.config.js testDir glob — no extra workflow step
// needed; new tests run in whichever shard Playwright assigns them.

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Each route entry pairs a path with a CSS selector to wait for so we
// don't run axe against a half-rendered SPA shell.  Using a real
// visible element (not just `body`) avoids the "tested 0 nodes" trap.
const ROUTES = [
    { path: '/', wait: 'h1' },
    { path: '/create', wait: 'main' },
    { path: '/endless', wait: 'main' },
    { path: '/nonexistent', wait: 'main' },
    // /test/:id needs a real id; without one, the page either redirects
    // or shows a generic error.  We scan the error path for completeness.
    { path: '/test/does-not-exist', wait: 'main' },
];

for (const { path, wait } of ROUTES) {
    test(`a11y: ${path} has no critical/serious WCAG violations`, async ({ page }) => {
        await page.goto(BASE_URL + path);
        await page.waitForSelector(wait, { timeout: 10_000 });
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();
        const blocking = results.violations.filter(v =>
            v.impact === 'critical' || v.impact === 'serious'
        );
        // Surface non-blocking findings in the report so trends are visible
        // without failing the gate.
        const advisory = results.violations.filter(v =>
            v.impact === 'moderate' || v.impact === 'minor'
        );
        if (advisory.length > 0) {
            // eslint-disable-next-line no-console
            console.log(`[a11y advisory] ${path}: ${advisory.length} moderate/minor finding(s)`);
        }
        expect(blocking).toEqual([]);
    });
}
