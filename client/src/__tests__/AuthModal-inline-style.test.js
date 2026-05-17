/**
 * Regression for issue #186:
 * AuthModal used `style={{ width: '100%', marginTop: 16|12 }}` on two
 * UiButton instances. CLAUDE.md mandates styled-components only and
 * forbids magic numbers; theme spacing should be used instead.
 *
 * Lock in via source-level assertion that AuthModal.jsx contains no
 * inline `style={{` literal.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(HERE, '../components/AuthModal.jsx'),
  'utf-8'
);

describe('AuthModal no inline styles (#186)', () => {
  it('does NOT use any inline `style={{` literals', () => {
    expect(SRC).not.toMatch(/style=\{\{/);
  });
});
