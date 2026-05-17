// Issue #210 — guarantee at least one Test record exists before any
// Playwright spec runs.
//
// Background: tests/manual-audit.spec.js is gated by
// `test.skip(!testUrl, 'No tests available')` after fetching
// /api/tests?limit=1.  In CI the DB starts empty; without something
// seeding it, every manual-audit case silently passes by skipping.
//
// This globalSetup waits for the server to come up (Playwright's
// webServer block already does that, but we cross-check) and then
// polls /api/tests?limit=1 until either a test appears or a timeout
// fires.  Pairs with ENABLE_AUTO_IMPORT=true in the CI env block so
// the on-boot auto-importer populates the fixtures from
// additionalContext/tests/*.md.

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TIMEOUT_MS = 60_000;
const POLL_MS = 2_000;

module.exports = async () => {
    const deadline = Date.now() + TIMEOUT_MS;
    let lastErr;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${API_URL}/api/tests?limit=1`);
            if (res.ok) {
                const body = await res.json();
                if (body?.tests?.length > 0) {
                    // eslint-disable-next-line no-console
                    console.log(`[e2e setup] ${body.tests.length} test(s) available — proceeding`);
                    return;
                }
            }
        } catch (err) {
            lastErr = err;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
    }
    const detail = lastErr ? ` (last error: ${lastErr.message})` : '';
    throw new Error(
        `[e2e setup] No test fixtures available after ${TIMEOUT_MS / 1000}s${detail}.  ` +
        `Check that ENABLE_AUTO_IMPORT=true is set in the server env and that ` +
        `additionalContext/tests/ contains at least one .md fixture.`
    );
};
