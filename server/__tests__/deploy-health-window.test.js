// Issue #473 — deploy.yml health-check window must be at least 5
// minutes so a fresh-DB cold boot (mongo connect + curriculum seed +
// autoImporter) doesn't time out.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const deploy = readFileSync(resolve(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

describe('Issue #473 — deploy health-check window ≥ 5 minutes', () => {
    it('declares HEALTH_TIMEOUT_S ≥ 300', () => {
        const m = deploy.match(/HEALTH_TIMEOUT_S=(\d+)/);
        expect(m).toBeTruthy();
        expect(Number(m[1])).toBeGreaterThanOrEqual(300);
    });

    it('does not still hardcode the old 30-attempt loop', () => {
        expect(deploy).not.toMatch(/for i in \$\(seq 1 30\); do[\s\S]{0,80}sleep 5/);
    });

    it('logs intermittent status so a slow boot does not look frozen', () => {
        expect(deploy).toMatch(/Health probe still failing at attempt/);
    });
});
