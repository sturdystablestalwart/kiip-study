// Issue #8 — pure mapping from remaining seconds → i18n key suffix.
// Returns one of: 'tenMinutes' | 'fiveMinutes' | 'oneMinute' |
// 'thirtySeconds' | 'expired' | null.  Lives in utils/ so the
// TestTaker module only exports its component (Fast Refresh rule
// react-refresh/only-export-components).
export function announcementKeyForTime(timeLeft, timerExpired) {
    if (timeLeft === 600) return 'tenMinutes';
    if (timeLeft === 300) return 'fiveMinutes';
    if (timeLeft === 60) return 'oneMinute';
    if (timeLeft === 30) return 'thirtySeconds';
    if (timeLeft === 0 && !timerExpired) return 'expired';
    return null;
}
