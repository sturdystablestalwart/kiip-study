import { describe, it, expect } from 'vitest';
import { findDuplicates, checkAgainstExisting } from '../dedup.js';

// ─── normalize (tested indirectly via findDuplicates/checkAgainstExisting) ───
// Issue #134 — findDuplicates is now async; every call is awaited.

describe('normalize behavior', () => {
  it('treats texts differing only by case as duplicates', async () => {
    const questions = [
      { text: 'What is Korea?' },
      { text: 'WHAT IS KOREA?' },
    ];
    const clusters = await findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('treats texts differing only by whitespace as duplicates', async () => {
    const questions = [
      { text: 'What  is   Korea?' },
      { text: 'What is Korea?' },
    ];
    const clusters = await findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('strips punctuation but preserves Korean characters', async () => {
    const questions = [
      { text: '한국의 수도는 어디입니까?' },
      { text: '한국의 수도는 어디입니까' },
    ];
    const clusters = await findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('preserves Korean Jamo characters', async () => {
    const questions = [
      { text: 'ㄱ ㄴ ㄷ' },
      { text: 'ㄱ ㄴ ㄷ!' },
    ];
    const clusters = await findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });
});

// ─── findDuplicates ───

describe('findDuplicates', () => {
  it('returns empty array for no duplicates', async () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'How many provinces does Korea have?' },
    ];
    expect(await findDuplicates(questions)).toEqual([]);
  });

  it('clusters identical texts', async () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = await findDuplicates(questions);
    expect(clusters.length).toBe(1);
    expect(clusters[0].questions.length).toBe(2);
  });

  it('clusters similar texts above threshold', async () => {
    const questions = [
      { text: 'What is the capital city of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = await findDuplicates(questions, 0.7);
    expect(clusters.length).toBe(1);
  });

  it('does not cluster texts below threshold', async () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'How old is the Korean flag?' },
    ];
    const clusters = await findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(0);
  });

  it('returns empty for single question', async () => {
    expect(await findDuplicates([{ text: 'Hello' }])).toEqual([]);
  });

  it('returns empty for empty array', async () => {
    expect(await findDuplicates([])).toEqual([]);
  });

  it('respects custom threshold', async () => {
    const questions = [
      { text: 'What is Korea?' },
      { text: 'What is Japan?' },
    ];
    const lowThreshold = await findDuplicates(questions, 0.3);
    const highThreshold = await findDuplicates(questions, 0.95);
    expect(highThreshold.length).toBe(0);
    expect(Array.isArray(lowThreshold)).toBe(true);
  });

  it('includes similarity score on the cluster', async () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = await findDuplicates(questions);
    expect(clusters[0]).toHaveProperty('similarity');
    expect(typeof clusters[0].similarity).toBe('number');
    expect(clusters[0].similarity).toBe(1);
  });

  it('handles multiple clusters', async () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
      { text: 'How many people live in Seoul?' },
      { text: 'How many people live in Seoul?' },
    ];
    const clusters = await findDuplicates(questions);
    expect(clusters.length).toBe(2);
  });
});

// ─── checkAgainstExisting (still synchronous) ───

describe('checkAgainstExisting', () => {
  const existing = [
    { text: 'What is the capital of Korea?' },
    { text: 'How many provinces does Korea have?' },
  ];

  it('finds matches above threshold', () => {
    const newQuestions = [{ text: 'What is the capital of Korea?' }];
    const results = checkAgainstExisting(newQuestions, existing);
    expect(results.length).toBe(1);
    expect(results[0].duplicates.length).toBeGreaterThanOrEqual(1);
    expect(results[0].duplicates[0].score).toBe(100);
  });

  it('returns empty when no matches', () => {
    const newQuestions = [{ text: 'What color is the sky?' }];
    const results = checkAgainstExisting(newQuestions, existing);
    expect(results.length).toBe(0);
  });

  it('sorts matches by score descending', () => {
    const newQuestions = [{ text: 'What is the capital city of Korea?' }];
    const results = checkAgainstExisting(newQuestions, existing, 0.5);
    if (results.length > 0 && results[0].duplicates.length > 1) {
      const scores = results[0].duplicates.map(d => d.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('handles empty new questions', () => {
    expect(checkAgainstExisting([], existing)).toEqual([]);
  });

  it('handles empty existing questions', () => {
    const newQuestions = [{ text: 'What is Korea?' }];
    expect(checkAgainstExisting(newQuestions, [])).toEqual([]);
  });

  it('respects custom threshold', () => {
    const newQuestions = [{ text: 'What is the capital of Korea?' }];
    const strict = checkAgainstExisting(newQuestions, existing, 0.99);
    const lenient = checkAgainstExisting(newQuestions, existing, 0.5);
    expect(strict.length).toBe(1);
    expect(lenient.length).toBe(1);
  });

  it('preserves question index', () => {
    const newQuestions = [
      { text: 'No match here' },
      { text: 'What is the capital of Korea?' },
    ];
    const results = checkAgainstExisting(newQuestions, existing);
    expect(results.length).toBe(1);
    expect(results[0].index).toBe(1);
  });
});
