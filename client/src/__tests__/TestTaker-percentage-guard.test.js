/**
 * Regression for issue #153:
 * TestTaker computed result percentage as
 *   `Math.round((score / test.questions.length) * 100)`
 * with no zero-guard. If admin edits a test down to zero questions while
 * another user has it open, submission shows `NaN%`.
 *
 * Lock in that the division is guarded: either `test.questions.length > 0`
 * before the division, or the division is in the truthy branch of a
 * ternary whose condition checks that length.
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

describe('TestTaker percentage zero-guard (#153)', () => {
  it('the score/length division is wrapped in a length>0 guard', () => {
    const m = SRC.match(/const\s+percentage\s*=\s*([\s\S]{0,200})/);
    expect(m, 'percentage assignment must exist').toBeTruthy();
    const ctx = m[1];

    expect(ctx).toMatch(/score\s*\/\s*test\.questions\.length/);
    const hasGuard =
      /test\.questions\.length\s*>\s*0/.test(ctx) ||
      /test\.questions\.length\s*!==?\s*0/.test(ctx) ||
      /test\.questions\.length\s*&&/.test(ctx);
    expect(
      hasGuard,
      'percentage assignment must guard against test.questions.length === 0'
    ).toBe(true);
  });
});
