import { describe, it, expect, beforeEach } from 'vitest';
import { getAnonymousAttempts, saveAnonymousAttempt, clearAnonymousAttempts, hasAnonymousAttempts } from '../anonymousAttempts';

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('anonymousAttempts', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    describe('getAnonymousAttempts', () => {
        it('returns empty array when no data', () => {
            expect(getAnonymousAttempts()).toEqual([]);
        });

        it('returns parsed attempts from localStorage', () => {
            const attempts = [{ testId: '1', score: 5 }];
            localStorage.setItem('kiip_attempts', JSON.stringify(attempts));
            expect(getAnonymousAttempts()).toEqual(attempts);
        });

        it('returns empty array on corrupted JSON', () => {
            localStorage.setItem('kiip_attempts', 'not-json');
            expect(getAnonymousAttempts()).toEqual([]);
        });
    });

    describe('saveAnonymousAttempt', () => {
        it('saves attempt with createdAt timestamp', () => {
            saveAnonymousAttempt({ testId: 'abc', score: 10, totalQuestions: 20 });
            const result = getAnonymousAttempts();
            expect(result).toHaveLength(1);
            expect(result[0].testId).toBe('abc');
            expect(result[0].score).toBe(10);
            expect(result[0].createdAt).toBeDefined();
        });

        // Issue #462 — return { ok } instead of throwing on storage failure.
        it('returns { ok: true } on happy path', () => {
            const r = saveAnonymousAttempt({ testId: 'abc', score: 1, totalQuestions: 1 });
            expect(r).toEqual({ ok: true });
        });

        it('returns { ok: false, reason: "QuotaExceededError" } on quota exhaustion (does NOT throw)', () => {
            const original = localStorage.setItem;
            localStorage.setItem = () => {
                const err = new Error('quota');
                err.name = 'QuotaExceededError';
                throw err;
            };
            try {
                const r = saveAnonymousAttempt({ testId: 'abc', score: 1, totalQuestions: 1 });
                expect(r).toEqual({ ok: false, reason: 'QuotaExceededError' });
            } finally {
                localStorage.setItem = original;
            }
        });

        it('returns { ok: false, reason: "SecurityError" } when Firefox blocks storage', () => {
            const original = localStorage.setItem;
            localStorage.setItem = () => {
                const err = new Error('blocked');
                err.name = 'SecurityError';
                throw err;
            };
            try {
                const r = saveAnonymousAttempt({ testId: 'x', score: 0, totalQuestions: 1 });
                expect(r).toEqual({ ok: false, reason: 'SecurityError' });
            } finally {
                localStorage.setItem = original;
            }
        });

        it('appends to existing attempts', () => {
            saveAnonymousAttempt({ testId: '1', score: 5 });
            saveAnonymousAttempt({ testId: '2', score: 8 });
            expect(getAnonymousAttempts()).toHaveLength(2);
        });

        it('trims to 50 max attempts', () => {
            for (let i = 0; i < 55; i++) {
                saveAnonymousAttempt({ testId: String(i), score: i });
            }
            const result = getAnonymousAttempts();
            expect(result).toHaveLength(50);
            // Should keep the last 50 (indices 5-54)
            expect(result[0].testId).toBe('5');
            expect(result[49].testId).toBe('54');
        });
    });

    describe('clearAnonymousAttempts', () => {
        it('removes all attempts', () => {
            saveAnonymousAttempt({ testId: '1', score: 5 });
            clearAnonymousAttempts();
            expect(getAnonymousAttempts()).toEqual([]);
        });
    });

    describe('hasAnonymousAttempts', () => {
        it('returns false when empty', () => {
            expect(hasAnonymousAttempts()).toBe(false);
        });

        it('returns true when attempts exist', () => {
            saveAnonymousAttempt({ testId: '1', score: 5 });
            expect(hasAnonymousAttempts()).toBe(true);
        });
    });
});
