// Issue #501 — client/lighthouse-budget.json exists and declares
// the Core Web Vitals + bundle-size budgets that lock perf wins in.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const path = resolve(__dirname, '..', '..', 'client', 'lighthouse-budget.json');

describe('Issue #501 — Lighthouse budget config', () => {
    it('exists at client/lighthouse-budget.json', () => {
        expect(existsSync(path)).toBe(true);
    });

    it('declares both resourceSizes and timings budgets', () => {
        const cfg = JSON.parse(readFileSync(path, 'utf8'));
        expect(Array.isArray(cfg)).toBe(true);
        const first = cfg[0];
        expect(Array.isArray(first.resourceSizes)).toBe(true);
        expect(Array.isArray(first.timings)).toBe(true);
    });

    it('caps key Core Web Vitals (LCP, TBT, CLS)', () => {
        const cfg = JSON.parse(readFileSync(path, 'utf8'));
        const metrics = cfg[0].timings.map(t => t.metric);
        expect(metrics).toContain('largest-contentful-paint');
        expect(metrics).toContain('total-blocking-time');
        expect(metrics).toContain('cumulative-layout-shift');
    });
});
