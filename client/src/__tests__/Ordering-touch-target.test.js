/**
 * Regression for issue #75:
 * Ordering ArrowButton was 32x32px — squeaks past WCAG 2.5.8 minimum (24x24)
 * but well below 2.5.5 enhanced (44x44). The buttons are stacked + adjacent
 * so mis-taps on touch / motor-impaired users are likely. Bump to 44x44 to
 * meet WCAG 2.5.5 (AAA touch target).
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

function parsePx(value) {
  const match = value.match(/(\d+)px/);
  return match ? Number(match[1]) : NaN;
}

describe('Ordering ArrowButton touch-target (#75)', () => {
  it('ArrowButton width meets WCAG 2.5.5 minimum (>= 44px)', () => {
    const block = SRC.match(/const ArrowButton = styled\.button`([\s\S]*?)`;/);
    expect(block).toBeTruthy();
    const css = block[1];
    const widthMatch = css.match(/^\s*width:\s*(\S+);/m);
    expect(widthMatch, 'ArrowButton must declare an explicit width').toBeTruthy();
    expect(parsePx(widthMatch[1])).toBeGreaterThanOrEqual(44);
  });

  it('ArrowButton height meets WCAG 2.5.5 minimum (>= 44px)', () => {
    const block = SRC.match(/const ArrowButton = styled\.button`([\s\S]*?)`;/);
    const css = block[1];
    const heightMatch = css.match(/^\s*height:\s*(\S+);/m);
    expect(heightMatch, 'ArrowButton must declare an explicit height').toBeTruthy();
    expect(parsePx(heightMatch[1])).toBeGreaterThanOrEqual(44);
  });
});
