/**
 * Regression for issue #86:
 * `.github/workflows/ci.yml` and `deploy.yml` had no top-level
 * `permissions:` declaration. The default GITHUB_TOKEN inherits the
 * org-level setting; for older orgs that means `write-all`, giving a
 * compromised CI step write access to issues, PRs, contents, and
 * packages. Least-privilege requires an explicit declaration.
 *
 * Lock in: every workflow file declares a `permissions:` block at the
 * workflow level (or per-job, but easier to read at top-level).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const WORKFLOWS = ['ci.yml', 'deploy.yml'];

describe('GitHub Actions workflow permissions (#86)', () => {
  for (const file of WORKFLOWS) {
    it(`${file} declares a top-level permissions block`, () => {
      const src = fs.readFileSync(
        path.join(REPO_ROOT, '.github', 'workflows', file),
        'utf-8'
      );
      expect(src).toMatch(/^permissions:\s*$/m);
    });
  }
});
