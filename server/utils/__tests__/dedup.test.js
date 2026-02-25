import { describe, it, expect } from 'vitest';
import { findDuplicates, checkAgainstExisting } from '../dedup.js';

// ─── normalize (tested indirectly via findDuplicates/checkAgainstExisting) ───

describe('normalize behavior', () => {
  it('treats texts differing only by case as duplicates', () => {
    const questions = [
      { text: 'What is Korea?' },
      { text: 'WHAT IS KOREA?' },
    ];
    const clusters = findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('treats texts differing only by whitespace as duplicates', () => {
    const questions = [
      { text: 'What  is   Korea?' },
      { text: 'What is Korea?' },
    ];
    const clusters = findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('strips punctuation but preserves Korean characters', () => {
    const questions = [
      { text: '한국의 수도는 어디입니까?' },
      { text: '한국의 수도는 어디입니까' },
    ];
    const clusters = findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });

  it('preserves Korean Jamo characters', () => {
    const questions = [
      { text: 'ㄱ ㄴ ㄷ' },
      { text: 'ㄱ ㄴ ㄷ!' },
    ];
    const clusters = findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(1);
  });
});

// ─── findDuplicates ───

describe('findDuplicates', () => {
  it('returns empty array for no duplicates', () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'How many provinces does Korea have?' },
    ];
    expect(findDuplicates(questions)).toEqual([]);
  });

  it('clusters identical texts', () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = findDuplicates(questions);
    expect(clusters.length).toBe(1);
    expect(clusters[0].length).toBe(2);
  });

  it('clusters similar texts above threshold', () => {
    const questions = [
      { text: 'What is the capital city of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = findDuplicates(questions, 0.7);
    expect(clusters.length).toBe(1);
  });

  it('does not cluster texts below threshold', () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'How old is the Korean flag?' },
    ];
    const clusters = findDuplicates(questions, 0.9);
    expect(clusters.length).toBe(0);
  });

  it('returns empty for single question', () => {
    expect(findDuplicates([{ text: 'Hello' }])).toEqual([]);
  });

  it('returns empty for empty array', () => {
    expect(findDuplicates([])).toEqual([]);
  });

  it('respects custom threshold', () => {
    const questions = [
      { text: 'What is Korea?' },
      { text: 'What is Japan?' },
    ];
    // At very low threshold these might cluster
    const lowThreshold = findDuplicates(questions, 0.3);
    const highThreshold = findDuplicates(questions, 0.95);
    expect(highThreshold.length).toBe(0);
    // Low threshold may or may not match — just ensure it doesn't crash
    expect(Array.isArray(lowThreshold)).toBe(true);
  });

  it('includes score in cluster entries', () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
    ];
    const clusters = findDuplicates(questions);
    expect(clusters[0][1]).toHaveProperty('score');
    expect(typeof clusters[0][1].score).toBe('number');
    expect(clusters[0][1].score).toBe(100);
  });

  it('handles multiple clusters', () => {
    const questions = [
      { text: 'What is the capital of Korea?' },
      { text: 'What is the capital of Korea?' },
      { text: 'How many people live in Seoul?' },
      { text: 'How many people live in Seoul?' },
    ];
    const clusters = findDuplicates(questions);
    expect(clusters.length).toBe(2);
  });
});

// ─── checkAgainstExisting ───

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
    // Exact match should pass both
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
