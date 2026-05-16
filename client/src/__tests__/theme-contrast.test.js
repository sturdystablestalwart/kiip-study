import { describe, test, expect } from 'vitest';
import { lightTheme, darkTheme } from '../theme/tokens.js';

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]) {
  const ch = v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrastRatio(a, b) {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const WCAG_AA_NORMAL = 4.5;

describe('Theme color-contrast (WCAG 2.1 AA)', () => {
  describe('lightTheme.accent.clay used as text', () => {
    const clay = lightTheme.colors.accent.clay;
    const bgs = {
      'bg.canvas': lightTheme.colors.bg.canvas,
      'bg.surface': lightTheme.colors.bg.surface,
      'bg.surfaceAlt': lightTheme.colors.bg.surfaceAlt,
      'interactive.hoverBg': lightTheme.colors.interactive.hoverBg,
      'interactive.activeBg': lightTheme.colors.interactive.activeBg,
    };
    for (const [name, bg] of Object.entries(bgs)) {
      test(`clay text on ${name} meets AA (>= 4.5:1)`, () => {
        expect(contrastRatio(clay, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });

  describe('lightTheme.onAccent (white) on accent.clay backgrounds', () => {
    const onAccent = lightTheme.colors.onAccent;
    test('white on accent.clay meets AA', () => {
      expect(contrastRatio(onAccent, lightTheme.colors.accent.clay)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
    test('white on accent.clayHover meets AA', () => {
      expect(contrastRatio(onAccent, lightTheme.colors.accent.clayHover)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('darkTheme.accent.clay used as text', () => {
    const clay = darkTheme.colors.accent.clay;
    const bgs = {
      'bg.canvas': darkTheme.colors.bg.canvas,
      'bg.surface': darkTheme.colors.bg.surface,
      'bg.surfaceAlt': darkTheme.colors.bg.surfaceAlt,
    };
    for (const [name, bg] of Object.entries(bgs)) {
      test(`clay text on ${name} meets AA (>= 4.5:1)`, () => {
        expect(contrastRatio(clay, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });
});
