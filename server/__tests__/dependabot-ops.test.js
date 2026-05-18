// Issue #494 — dependabot must watch /ops/caddy and /ops/backup
// Dockerfiles for base-image CVE bumps.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cfg = readFileSync(resolve(__dirname, '..', '..', '.github', 'dependabot.yml'), 'utf8');

describe('Issue #494 — dependabot ops Dockerfiles', () => {
    it('declares docker entry for /ops/caddy', () => {
        expect(cfg).toMatch(/package-ecosystem:\s*"docker"[\s\S]*?directory:\s*"\/ops\/caddy"/);
    });

    it('declares docker entry for /ops/backup', () => {
        expect(cfg).toMatch(/package-ecosystem:\s*"docker"[\s\S]*?directory:\s*"\/ops\/backup"/);
    });
});
