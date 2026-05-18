// Issue #481 — CSP-friendly replacement for the inline
// `onload="this.onload=null;this.rel='stylesheet'"` attribute on the
// font preload links in index.html. Once the SPA shell ships CSP
// `script-src 'self'` (#467), inline onload attributes are blocked
// silently and the fonts never promote from preload to stylesheet.
// This module performs the swap in bundled-app JS instead.

const PRELOAD_IDS = ['kiip-font-noto', 'kiip-font-inter'];

function promote(el) {
    if (!el || el.rel === 'stylesheet') return;
    el.rel = 'stylesheet';
}

export function setupFontPreloadSwap() {
    if (typeof document === 'undefined') return;
    for (const id of PRELOAD_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.dataset.loaded === 'true') {
            promote(el);
            continue;
        }
        const onload = () => {
            el.dataset.loaded = 'true';
            promote(el);
            el.removeEventListener('load', onload);
        };
        el.addEventListener('load', onload, { once: true });
    }
}
