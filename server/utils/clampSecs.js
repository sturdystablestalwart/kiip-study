// Issue #132 / #433 — clamp client-supplied second-valued fields into
// [0, MAX_SECONDS]. Used by attempt and session-submit routes so a
// doctored client can't poison stats with negative, NaN, string, or
// absurdly large duration / overdueTime values.
const MAX_SECONDS = 4 * 3600; // 4 hours

function clampSecs(v) {
    return Math.max(0, Math.min(Number(v) || 0, MAX_SECONDS));
}

module.exports = { clampSecs, MAX_SECONDS };
