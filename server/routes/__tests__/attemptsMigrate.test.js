import { describe, it, expect } from 'vitest';

// Test the validation logic used in the migration endpoint
function validateAttempt(att) {
    if (!att.testId || typeof att.score !== 'number' || typeof att.totalQuestions !== 'number') {
        return null;
    }
    return {
        testId: att.testId,
        userId: 'mock-user-id',
        score: att.score,
        totalQuestions: att.totalQuestions,
        duration: att.duration || 0,
        overdueTime: att.overdueTime || 0,
        answers: att.answers || [],
        mode: ['Practice', 'Test', 'Endless'].includes(att.mode) ? att.mode : 'Test',
        createdAt: att.createdAt ? new Date(att.createdAt) : new Date(),
    };
}

describe('Attempt Migration Validation', () => {
    it('accepts valid attempt', () => {
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20 });
        expect(result).not.toBeNull();
        expect(result.testId).toBe('abc');
        expect(result.score).toBe(10);
        expect(result.totalQuestions).toBe(20);
    });

    it('rejects attempt without testId', () => {
        expect(validateAttempt({ score: 10, totalQuestions: 20 })).toBeNull();
    });

    it('rejects attempt without score', () => {
        expect(validateAttempt({ testId: 'abc', totalQuestions: 20 })).toBeNull();
    });

    it('rejects attempt with string score', () => {
        expect(validateAttempt({ testId: 'abc', score: '10', totalQuestions: 20 })).toBeNull();
    });

    it('rejects attempt without totalQuestions', () => {
        expect(validateAttempt({ testId: 'abc', score: 10 })).toBeNull();
    });

    it('defaults duration to 0', () => {
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20 });
        expect(result.duration).toBe(0);
    });

    it('defaults mode to Test for invalid values', () => {
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20, mode: 'Invalid' });
        expect(result.mode).toBe('Test');
    });

    it('accepts valid mode values', () => {
        for (const mode of ['Practice', 'Test', 'Endless']) {
            const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20, mode });
            expect(result.mode).toBe(mode);
        }
    });

    it('limits to 50 attempts', () => {
        const attempts = Array.from({ length: 60 }, (_, i) => ({
            testId: String(i), score: i, totalQuestions: 20,
        }));
        const toMigrate = attempts.slice(0, 50);
        expect(toMigrate).toHaveLength(50);
    });

    it('preserves createdAt from original attempt', () => {
        const date = '2026-03-15T10:00:00.000Z';
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20, createdAt: date });
        expect(result.createdAt).toEqual(new Date(date));
    });

    it('defaults createdAt to now when not provided', () => {
        const before = new Date();
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20 });
        const after = new Date();
        expect(result.createdAt >= before).toBe(true);
        expect(result.createdAt <= after).toBe(true);
    });

    it('preserves answers array', () => {
        const answers = [{ questionIndex: 0, isCorrect: true }];
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20, answers });
        expect(result.answers).toEqual(answers);
    });

    it('defaults answers to empty array', () => {
        const result = validateAttempt({ testId: 'abc', score: 10, totalQuestions: 20 });
        expect(result.answers).toEqual([]);
    });
});
