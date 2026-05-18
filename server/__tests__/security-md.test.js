// Issue #493 — SECURITY.md must exist at repo root and declare the
// minimum disclosure-policy sections so GitHub's "Security" tab
// promotes the project for a reporter.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const path = resolve(repoRoot, 'SECURITY.md');

describe('Issue #493 — SECURITY.md disclosure policy', () => {
    it('SECURITY.md exists at repo root', () => {
        expect(existsSync(path)).toBe(true);
    });

    it('documents how to report (Private Vulnerability Reporting)', () => {
        const md = readFileSync(path, 'utf8');
        expect(md).toMatch(/Private Vulnerability Reporting/i);
    });

    it('documents response targets (acknowledgement / triage / fix windows)', () => {
        const md = readFileSync(path, 'utf8');
        expect(md).toMatch(/Acknowledgement/i);
        expect(md).toMatch(/30 days|14 days|7 days/);
    });

    it('declares Supported Versions and Out of Scope sections', () => {
        const md = readFileSync(path, 'utf8');
        expect(md).toMatch(/Supported Versions/);
        expect(md).toMatch(/Out of Scope/);
    });
});
