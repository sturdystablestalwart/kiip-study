// Issue #481 — setupFontPreloadSwap must promote both font preload
// <link>s to rel='stylesheet' once they load, and do so in plain
// JS so no inline onload="..." attribute is needed (CSP-friendly).

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setupFontPreloadSwap } from '../fontPreloader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexHtml = readFileSync(resolve(__dirname, '..', '..', '..', 'index.html'), 'utf8');

function makeLink(id) {
    const el = document.createElement('link');
    el.id = id;
    el.rel = 'preload';
    el.setAttribute('as', 'style');
    el.href = `https://fonts.googleapis.com/${id}.css`;
    document.head.appendChild(el);
    return el;
}

beforeEach(() => {
    document.head.innerHTML = '';
});

describe('Issue #481 — fontPreloader swap', () => {
    it('promotes a preload link to stylesheet on `load` event', () => {
        const el = makeLink('kiip-font-noto');
        setupFontPreloadSwap();
        expect(el.rel).toBe('preload');
        el.dispatchEvent(new Event('load'));
        expect(el.rel).toBe('stylesheet');
    });

    it('promotes immediately when dataset.loaded === "true" (cache-hit early-fire)', () => {
        const el = makeLink('kiip-font-inter');
        el.dataset.loaded = 'true';
        setupFontPreloadSwap();
        expect(el.rel).toBe('stylesheet');
    });

    it('handles missing elements without throwing', () => {
        expect(() => setupFontPreloadSwap()).not.toThrow();
    });
});

describe('Issue #481 — index.html source guarantee', () => {
    it('does not contain any inline onload="..." attribute on a real element', () => {
        // The descriptive prose in the leading <!-- ... --> block may
        // legitimately mention `onload="..."`. Strip HTML comments
        // before checking for actual attribute usage.
        const stripped = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
        expect(stripped).not.toMatch(/onload=/);
    });

    it('declares both font preload links with the documented IDs', () => {
        expect(indexHtml).toMatch(/id="kiip-font-noto"/);
        expect(indexHtml).toMatch(/id="kiip-font-inter"/);
    });
});
