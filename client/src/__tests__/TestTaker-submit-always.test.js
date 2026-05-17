/**
 * Regression for issue #156:
 * Submit was previously rendered ONLY when `!canGoNext` (i.e. on the
 * final question). Users finishing answers out of order had to navigate
 * to the very last question before submitting.
 *
 * Lock in: the Submit button is NOT gated by `canGoNext`. Instead the
 * Submit JSX must appear inside the non-reviewMode Controls branch
 * regardless of position.
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

describe('TestTaker Submit always visible (#156)', () => {
  it('does NOT gate Submit behind `: canGoNext ? ... : (Submit...)`', () => {
    expect(SRC).not.toMatch(/:\s*canGoNext\s*\?[\s\S]{0,400}?<Button onClick=\{handleSubmit\}/);
  });

  it('renders Submit JSX in the source', () => {
    expect(SRC).toMatch(/<Button onClick=\{handleSubmit\}/);
  });
});
