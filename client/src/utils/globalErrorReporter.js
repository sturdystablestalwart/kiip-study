// Issue #31 — capture uncaught browser errors that escape React.
//
// ErrorBoundary already catches render-time React errors and reports
// them via POST /api/_log/client-error.  But three crash classes
// bypass React entirely:
//   1. `window.onerror` — uncaught exceptions thrown OUTSIDE React's
//      render/commit cycle (e.g., from an async callback or a setTimeout).
//   2. `unhandledrejection` — Promise rejections that escape every
//      .catch() handler.
//   3. ChunkLoadError reaching window before ErrorBoundary mounts.
//
// We install matching listeners that funnel into the same telemetry
// endpoint with a `source` tag so the server can distinguish them in
// pino logs.  No external SDK required; this is the "Option C"
// minimal-pino approach from #31.
//
// PROD-only because dev hot-reload errors are noisy and not actionable.
// Dedupe rapid duplicate events (same message + stack in <2s) so a
// runaway loop doesn't flood the endpoint.

const DEDUPE_WINDOW_MS = 2000;
const dedupe = new Map();

function shouldReport(key) {
    const now = Date.now();
    const last = dedupe.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return false;
    dedupe.set(key, now);
    // Bound the dedupe map so a long session doesn't leak memory.
    if (dedupe.size > 50) {
        const cutoff = now - DEDUPE_WINDOW_MS;
        for (const [k, t] of dedupe) {
            if (t < cutoff) dedupe.delete(k);
        }
    }
    return true;
}

function report(payload) {
    const key = `${payload.source}:${payload.message}`;
    if (!shouldReport(key)) return;
    try {
        fetch('/api/_log/client-error', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                message: payload.message,
                stack: (payload.stack || '').slice(0, 4000),
                source: payload.source,
                url: typeof location !== 'undefined' ? location.href : '',
                ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200),
            }),
        }).catch(() => {});
    } catch { /* never let telemetry mask the real error */ }
}

export function installGlobalErrorReporter() {
    if (typeof window === 'undefined' || !import.meta.env.PROD) return;

    window.addEventListener('error', (event) => {
        // event.error is the actual Error object (when available);
        // event.message is the string fallback.
        const err = event.error;
        report({
            source: 'window.onerror',
            message: err?.message ?? event.message ?? 'Unknown error',
            stack: err?.stack ?? '',
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const message = reason?.message
            ?? (typeof reason === 'string' ? reason : 'Unhandled promise rejection');
        report({
            source: 'unhandledrejection',
            message,
            stack: reason?.stack ?? '',
        });
    });
}
