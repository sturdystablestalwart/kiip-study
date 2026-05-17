/**
 * Regression for issue #87:
 * Workflows pinned actions by mutable major-version tag (`@v4`, `@v1`),
 * which silently updates to any new code maintainers (or attackers) push
 * to that tag — see tj-actions/changed-files 2025. SHA pinning makes
 * every action upgrade an explicit, reviewable commit.
 *
 * Lock in: every `uses:` line in the workflow files references a 40-char
 * commit SHA, not a tag like `@v4` or `@1.11.0`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const WORKFLOWS = ['ci.yml', 'deploy.yml'];

const SHA40 = /^[0-9a-f]{40}$/;

describe('GitHub Actions SHA-pinning (#87)', () => {
  for (const file of WORKFLOWS) {
    it(`${file} pins every action to a 40-char SHA`, () => {
      const src = fs.readFileSync(
        path.join(REPO_ROOT, '.github', 'workflows', file),
        'utf-8'
      );
      const usesLines = src
        .split('\n')
        .filter(line => /^\s*-?\s*uses:\s*\S+/.test(line));
      expect(usesLines.length, `${file} should declare at least one action`).toBeGreaterThan(0);
      for (const line of usesLines) {
        const m = line.match(/uses:\s*([^\s#]+)/);
        expect(m, `cannot parse uses line: ${line}`).toBeTruthy();
        const ref = m[1].split('@')[1];
        expect(
          SHA40.test(ref || ''),
          `Action pinned to non-SHA "${m[1]}" in ${file} — pin to 40-char commit SHA`
        ).toBe(true);
      }
    });
  }
});
