// Issue #472 — deploy.yml must post a success/failure notification
// to a webhook so a tag-triggered deploy that ran while the operator
// was away is visible without scrubbing the Actions dashboard.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const deploy = readFileSync(resolve(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'), 'utf8');

describe('Issue #472 — deploy outcome notification', () => {
    it('declares a `Notify deploy outcome` step', () => {
        expect(deploy).toMatch(/name:\s*Notify deploy outcome/);
    });

    it('runs the notification regardless of upstream job status (if: always())', () => {
        expect(deploy).toMatch(/Notify deploy outcome[\s\S]*?if:\s*always\(\)/);
    });

    it('reads DEPLOY_WEBHOOK_URL from secrets and short-circuits when unset', () => {
        expect(deploy).toMatch(/DEPLOY_WEBHOOK_URL:\s*\$\{\{\s*secrets\.DEPLOY_WEBHOOK_URL\s*\}\}/);
        expect(deploy).toMatch(/-z\s+"\$\{?DEPLOY_WEBHOOK_URL/);
    });

    it('distinguishes success vs failure via JOB_STATUS', () => {
        expect(deploy).toMatch(/JOB_STATUS:\s*\$\{\{\s*job\.status\s*\}\}/);
        expect(deploy).toMatch(/JOB_STATUS\}?\"?\s*=\s*\"success\"/);
    });

    it('includes a link to the run logs in the payload', () => {
        expect(deploy).toMatch(/RUN_URL=.*github\.com\/\$\{REPO\}\/actions\/runs\/\$\{RUN_ID\}/);
    });
});
