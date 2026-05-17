/**
 * Regression tests for issue #144: dedup.normalize used /[^\w\s가-힯㄰-㆏]/g
 * (no Unicode flag), so it stripped fullwidth digits and any non-Hangul Unicode
 * letter — false-positive duplicates whenever two questions only differed by
 * those characters.
 */
import { describe, test, expect } from 'vitest';
import { findDuplicates } from '../dedup.js';

// Re-implements the internal `normalize` via the public findDuplicates surface
// by feeding crafted pairs and checking whether they cluster (similarity >= 0.75).
// This is more faithful to the bug because the normalize regex is private to
// the module.
// Issue #134 — findDuplicates is now async.
async function clusters(textA, textB) {
  return findDuplicates([
    { text: textA, testId: 'a', questionIndex: 0 },
    { text: textB, testId: 'b', questionIndex: 0 },
  ], 0.75);
}

describe('dedup.normalize Unicode awareness (#144)', () => {
  test('fullwidth digit ≠ ASCII digit — must NOT cluster as duplicates', async () => {
    const c = await clusters('문법 １과', '문법 ２과');
    expect(c).toEqual([]);
  });

  test('different fullwidth digits with otherwise identical body do NOT register as 100% match', async () => {
    const c = await clusters('１번 문항입니다', '９번 문항입니다');
    if (c.length > 0) {
      expect(c[0].similarity).toBeLessThan(1.0);
    }
  });

  test('identical Korean text DOES cluster (sanity)', async () => {
    const c = await clusters('이것은 시험 문제입니다', '이것은 시험 문제입니다');
    expect(c.length).toBe(1);
  });

  test('Korean text with different ASCII punctuation still clusters', async () => {
    const c = await clusters('문법 1과. 다음 문장을 읽으시오', '문법 1과! 다음 문장을 읽으시오');
    expect(c.length).toBe(1);
  });

  test('Hangul Jamo characters are preserved (not stripped)', async () => {
    const c = await clusters('ㄱ 다른 내용 A', 'ㄴ 다른 내용 B');
    expect(c).toEqual([]);
  });
});
