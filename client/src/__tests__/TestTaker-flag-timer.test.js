/**
 * Regression for issue #157:
 * `handleFlagSubmit` scheduled an orphan `setTimeout(..., 1500)` that
 * closes the flag modal. If a user reopens the modal within 1.5s, the
 * pending timer dismisses the freshly-opened one.
 *
 * Lock in: (a) the timer ID is captured in a ref so it can be cleared,
 * (b) a useEffect cleanup or `closeFlagModal` helper invokes clearTimeout.
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

describe('TestTaker flag-modal timer cleanup (#157)', () => {
  it('captures the success-close setTimeout id in a ref', () => {
    expect(SRC).toMatch(/flag\w*TimerRef\.current\s*=\s*setTimeout/);
  });

  it('clears the timer via clearTimeout', () => {
    expect(SRC).toMatch(/clearTimeout\(flag\w*TimerRef\.current\)/);
  });
});
