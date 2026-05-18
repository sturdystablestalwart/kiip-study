/**
 * Per-admin daily Gemini-call quota (issue #66).
 *
 * One admin running back-to-back generations (or a compromised admin
 * account) can otherwise exhaust the project-wide GEMINI_API_KEY budget
 * within minutes — the IP-level rate limit is too coarse and the Gemini
 * billing dashboard is the only after-the-fact signal.
 *
 * In-memory counter keyed by `${userId}|${YYYY-MM-DD-UTC}`.  The app is
 * single-instance (per CLAUDE.md) so an in-memory bucket is enough for
 * now; a multi-replica deployment should swap this for a small Mongo
 * collection.  Limit defaults to 50 and is tunable via the env var
 * GEMINI_DAILY_CALL_LIMIT.
 */

const DEFAULT_LIMIT = 50;
const counts = new Map();

function key(userId) {
    const dayUTC = new Date().toISOString().slice(0, 10);
    return `${String(userId)}|${dayUTC}`;
}

function getLimit() {
    const fromEnv = Number(process.env.GEMINI_DAILY_CALL_LIMIT);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_LIMIT;
}

/**
 * Try to charge one call against today's budget for this admin.
 * Returns { allowed: true, remaining } on success, or
 * { allowed: false, limit, used } on quota exceeded.
 */
function consume(userId) {
    if (!userId) return { allowed: true, remaining: Infinity };
    const k = key(userId);
    const used = counts.get(k) || 0;
    const limit = getLimit();
    if (used >= limit) {
        return { allowed: false, limit, used };
    }
    counts.set(k, used + 1);
    return { allowed: true, remaining: limit - (used + 1) };
}

// Periodic reaper (issue #491) — drops non-today keys so the map
// doesn't grow with every distinct admin × distinct day over a
// multi-week uptime window. Hourly cadence; unref()d so vitest can
// exit cleanly and skipped in NODE_ENV=test for deterministic specs.
if (process.env.NODE_ENV !== 'test') {
    const reaper = setInterval(() => {
        const todayKey = new Date().toISOString().slice(0, 10);
        for (const k of counts.keys()) {
            const day = k.split('|')[1];
            if (day !== todayKey) counts.delete(k);
        }
    }, 3600 * 1000);
    if (reaper.unref) reaper.unref();
}

// Visible for tests + ops scripts.
function _peek(userId) {
    return counts.get(key(userId)) || 0;
}
function _reset() {
    counts.clear();
}

module.exports = { consume, getLimit, _peek, _reset };
