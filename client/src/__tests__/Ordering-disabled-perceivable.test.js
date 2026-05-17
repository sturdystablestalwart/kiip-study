/**
 * Regression for issue #77:
 * Ordering's ArrowButton signaled the disabled state with `opacity: 0.3`
 * alone. Colorblind and low-vision users (and Windows High Contrast)
 * cannot reliably perceive the opacity drop. A second non-color cue is
 * required (WCAG 1.4.1 Use of Color).
 *
 * This test locks in that the `&:disabled` block declares at least one
 * structural cue beyond opacity — currently a dashed border + transparent
 * background. Future regressions that strip the extra cue will fail.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(
  path.resolve(HERE, '../components/question-types/Ordering.jsx'),
  'utf-8'
);

function disabledBlock() {
  const m = SRC.match(/const ArrowButton = styled\.button`([\s\S]*?)`;/);
  if (!m) return null;
  const css = m[1];
  const dis = css.match(/&:disabled\s*\{([\s\S]*?)\}/);
  return dis ? dis[1] : null;
}

describe('Ordering ArrowButton disabled non-opacity cue (#77)', () => {
  it('has a &:disabled block', () => {
    expect(disabledBlock()).not.toBeNull();
  });

  it('declares a structural cue beyond opacity', () => {
    const block = disabledBlock();
    expect(block).not.toBeNull();
    const hasBorderCue = /border(-style)?\s*:\s*[^;]*?\b(dashed|dotted|double)\b/.test(block);
    const hasBgCue = /background\s*:/.test(block);
    const hasTextDeco = /text-decoration\s*:/.test(block);
    const hasOutline = /outline\s*:/.test(block);
    expect(
      hasBorderCue || hasBgCue || hasTextDeco || hasOutline,
      'disabled state must use a non-opacity cue (border style, background, outline, or text-decoration)'
    ).toBe(true);
  });
});
