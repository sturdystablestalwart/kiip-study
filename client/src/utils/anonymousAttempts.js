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

export function saveAnonymousAttempt(attempt) {
    const attempts = getAnonymousAttempts();
    attempts.push({
        ...attempt,
        createdAt: new Date().toISOString(),
    });
    const trimmed = attempts.slice(-MAX_ATTEMPTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function clearAnonymousAttempts() {
    localStorage.removeItem(STORAGE_KEY);
}

export function hasAnonymousAttempts() {
    return getAnonymousAttempts().length > 0;
}
