// Issue #471 — deploy.yml must snapshot mongo via mongodump before
// rebuilding containers. Image rollback can't undo destructive
// writes to the persistent mongo_data volume.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const deploy = readFileSync(resolve(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

describe('Issue #471 — pre-deploy mongodump', () => {
    it('includes a `mongodump ... --archive ... --gzip` step', () => {
        expect(deploy).toMatch(/docker exec\s+kiip-mongo\s+mongodump[\s\S]*--archive=/);
        expect(deploy).toMatch(/--gzip/);
    });

    it('archive filename embeds DEPLOY_SHA', () => {
        expect(deploy).toMatch(/pre-deploy-\$\{DEPLOY_SHA\}\.archive/);
    });

    it('rotates the snapshot directory (retain only N most recent)', () => {
        expect(deploy).toMatch(/pre-deploy-\*\.archive\.gz[\s\S]*tail -n \+\d/);
    });

    it("skips the snapshot when kiip-mongo container isn't running (first deploy)", () => {
        expect(deploy).toMatch(/docker ps[\s\S]*kiip-mongo[\s\S]*else[\s\S]*skipping pre-deploy snapshot/);
    });
});
