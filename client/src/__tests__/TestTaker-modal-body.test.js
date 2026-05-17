/**
 * Regression for issue #154:
 * Both exit-confirm and mode-switch modals rendered `<p></p>` (empty body)
 * after the heading. Users confirmed destructive actions with no body copy
 * explaining the consequence.
 *
 * Lock in that neither modal body remains empty — both must render some
 * non-empty content (e.g. `t('test.confirmExitBody')`).
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(HERE, '../pages/TestTaker.jsx'),
  'utf-8'
);

describe('TestTaker confirmation modal body copy (#154)', () => {
  it('has no empty <p></p> elements', () => {
    expect(SRC).not.toMatch(/<p>\s*<\/p>/);
  });

  it('renders body copy directly under the exit-confirm heading', () => {
    expect(SRC).toMatch(
      /<h3>\{t\('test\.confirmExit'\)\}<\/h3>\s*<p>\s*\{t\([^)]+\)\}\s*<\/p>/
    );
  });

  it('renders body copy directly under the mode-switch heading', () => {
    expect(SRC).toMatch(
      /<h3>\{t\('test\.confirmModeSwitch'\)\}<\/h3>\s*<p>\s*\{t\([^)]+\)\}\s*<\/p>/
    );
  });
});
