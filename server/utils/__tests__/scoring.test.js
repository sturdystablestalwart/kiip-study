import { describe, it, expect } from 'vitest';
import { scoreQuestion } from '../scoring.js';

// ─── MCQ-Single ───

describe('mcq-single', () => {
  const q = {
    type: 'mcq-single',
    options: [
      { text: 'A', isCorrect: false },
      { text: 'B', isCorrect: true },
      { text: 'C', isCorrect: false },
    ],
  };

  it('returns true when correct option selected', () => {
    expect(scoreQuestion(q, { selectedOptions: [1] })).toBe(true);
  });

  it('returns false when wrong option selected', () => {
    expect(scoreQuestion(q, { selectedOptions: [0] })).toBe(false);
  });

  it('returns false when no option selected', () => {
    expect(scoreQuestion(q, { selectedOptions: [] })).toBe(false);
  });

  it('returns false when selectedOptions is undefined', () => {
    expect(scoreQuestion(q, {})).toBe(false);
  });

  it('returns false for out-of-bounds index', () => {
    expect(scoreQuestion(q, { selectedOptions: [99] })).toBe(false);
  });

  it('handles "multiple-choice" alias', () => {
    const q2 = { ...q, type: 'multiple-choice' };
    expect(scoreQuestion(q2, { selectedOptions: [1] })).toBe(true);
    expect(scoreQuestion(q2, { selectedOptions: [0] })).toBe(false);
  });

  it('defaults to mcq-single when type is missing', () => {
    const noType = { options: q.options };
    expect(scoreQuestion(noType, { selectedOptions: [1] })).toBe(true);
  });
});

// ─── MCQ-Multiple ───

describe('mcq-multiple', () => {
  const q = {
    type: 'mcq-multiple',
    options: [
      { text: 'A', isCorrect: true },
      { text: 'B', isCorrect: false },
      { text: 'C', isCorrect: true },
      { text: 'D', isCorrect: false },
    ],
  };

  it('returns true when all correct options selected', () => {
    expect(scoreQuestion(q, { selectedOptions: [0, 2] })).toBe(true);
  });

  it('returns true regardless of order', () => {
    expect(scoreQuestion(q, { selectedOptions: [2, 0] })).toBe(true);
  });

  it('returns false when missing one correct option', () => {
    expect(scoreQuestion(q, { selectedOptions: [0] })).toBe(false);
  });

  it('returns false when extra wrong option selected', () => {
    expect(scoreQuestion(q, { selectedOptions: [0, 1, 2] })).toBe(false);
  });

  it('returns false when empty selection', () => {
    expect(scoreQuestion(q, { selectedOptions: [] })).toBe(false);
  });

  it('returns false when selectedOptions is undefined', () => {
    expect(scoreQuestion(q, {})).toBe(false);
  });

  it('handles question with no correct options', () => {
    const noCorrect = {
      type: 'mcq-multiple',
      options: [{ text: 'A', isCorrect: false }],
    };
    expect(scoreQuestion(noCorrect, { selectedOptions: [] })).toBe(true);
  });
});

// ─── Short Answer ───

describe('short-answer', () => {
  const q = {
    type: 'short-answer',
    acceptedAnswers: ['서울', 'Seoul'],
  };

  it('returns true for exact match', () => {
    expect(scoreQuestion(q, { textAnswer: '서울' })).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(scoreQuestion(q, { textAnswer: 'SEOUL' })).toBe(true);
  });

  it('returns true with extra whitespace', () => {
    expect(scoreQuestion(q, { textAnswer: '  Seoul  ' })).toBe(true);
  });

  it('returns false for wrong answer', () => {
    expect(scoreQuestion(q, { textAnswer: 'Busan' })).toBe(false);
  });

  it('returns false for empty answer', () => {
    expect(scoreQuestion(q, { textAnswer: '' })).toBe(false);
  });

  it('returns false for undefined textAnswer', () => {
    expect(scoreQuestion(q, {})).toBe(false);
  });

  it('returns false when no acceptedAnswers on question', () => {
    const noAnswers = { type: 'short-answer' };
    expect(scoreQuestion(noAnswers, { textAnswer: 'anything' })).toBe(false);
  });
});

// ─── Ordering ───

describe('ordering', () => {
  const q = {
    type: 'ordering',
    correctOrder: ['A', 'B', 'C', 'D'],
  };

  it('returns true for correct order', () => {
    expect(scoreQuestion(q, { orderedItems: ['A', 'B', 'C', 'D'] })).toBe(true);
  });

  it('returns false for wrong order', () => {
    expect(scoreQuestion(q, { orderedItems: ['D', 'C', 'B', 'A'] })).toBe(false);
  });

  it('returns false for different length', () => {
    expect(scoreQuestion(q, { orderedItems: ['A', 'B'] })).toBe(false);
  });

  it('returns false for empty submitted', () => {
    expect(scoreQuestion(q, { orderedItems: [] })).toBe(false);
  });

  it('returns false when orderedItems is undefined', () => {
    expect(scoreQuestion(q, {})).toBe(false);
  });
});

// ─── Fill-in-the-Blank ───

describe('fill-in-the-blank', () => {
  const q = {
    type: 'fill-in-the-blank',
    blanks: [
      { acceptedAnswers: ['한국', 'Korea'] },
      { acceptedAnswers: ['서울', 'Seoul'] },
    ],
  };

  it('returns true when all blanks correct', () => {
    expect(scoreQuestion(q, { blankAnswers: ['한국', '서울'] })).toBe(true);
  });

  it('returns true case-insensitively', () => {
    expect(scoreQuestion(q, { blankAnswers: ['korea', 'SEOUL'] })).toBe(true);
  });

  it('returns false when one blank wrong', () => {
    expect(scoreQuestion(q, { blankAnswers: ['한국', 'Busan'] })).toBe(false);
  });

  it('returns false for different length', () => {
    expect(scoreQuestion(q, { blankAnswers: ['한국'] })).toBe(false);
  });

  it('returns false for empty blanks', () => {
    expect(scoreQuestion(q, { blankAnswers: [] })).toBe(false);
  });

  it('returns false when blankAnswers is undefined', () => {
    expect(scoreQuestion(q, {})).toBe(false);
  });

  it('handles blank with no acceptedAnswers', () => {
    const noAnswers = { type: 'fill-in-the-blank', blanks: [{}] };
    expect(scoreQuestion(noAnswers, { blankAnswers: ['anything'] })).toBe(false);
  });
});

// ─── Unknown Type ───

describe('unknown type', () => {
  it('returns false for unrecognized question type', () => {
    expect(scoreQuestion({ type: 'essay' }, {})).toBe(false);
  });
});
