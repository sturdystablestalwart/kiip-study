const STORAGE_KEY = 'kiip_attempts';
const MAX_ATTEMPTS = 50;

export function getAnonymousAttempts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

// Issue #462 — wrap setItem so QuotaExceededError (Safari Private,
// iOS Safari Private quota=0), SecurityError (Firefox 'block storage'),
// or a missing localStorage no longer crashes the calling page and
// silently loses the user's attempt. Returns a structured result so
// callers can surface a toast.
export function saveAnonymousAttempt(attempt) {
    try {
        const attempts = getAnonymousAttempts();
        attempts.push({
            ...attempt,
            createdAt: new Date().toISOString(),
        });
        const trimmed = attempts.slice(-MAX_ATTEMPTS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: err?.name || 'unknown' };
    }
}

export function clearAnonymousAttempts() {
    localStorage.removeItem(STORAGE_KEY);
}

export function hasAnonymousAttempts() {
    return getAnonymousAttempts().length > 0;
}
