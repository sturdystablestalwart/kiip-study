// Issue #466 — every long-running service in docker-compose.yaml
// must reference a logging driver with a max-size + max-file cap so
// a chatty container can't fill the host disk over months.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compose = readFileSync(resolve(__dirname, '..', '..', 'docker-compose.yaml'), 'utf8');

describe('Issue #466 — docker logging size cap', () => {
    it('declares the default-logging YAML anchor with max-size + max-file', () => {
        expect(compose).toMatch(/x-logging:\s*&default-logging/);
        expect(compose).toMatch(/max-size:\s*"10m"/);
        expect(compose).toMatch(/max-file:\s*"3"/);
    });

    for (const svc of ['mongo', 'server', 'client', 'caddy', 'backup']) {
        it(`${svc} service references *default-logging`, () => {
            const startRe = new RegExp(`^  ${svc}:\\s*$`, 'm');
            const startMatch = compose.match(startRe);
            expect(startMatch).toBeTruthy();
            const startIdx = startMatch.index;
            const block = compose.slice(startIdx, startIdx + 4000);
            expect(block).toMatch(/logging:\s*\*default-logging/);
        });
    }
});
