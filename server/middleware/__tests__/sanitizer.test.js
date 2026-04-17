import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { sanitize } = require('../sanitizer');

describe('NoSQL sanitizer adversarial payloads', () => {
    test('strips top-level $operator keys', () => {
        const out = sanitize({ $where: 'evil', name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('strips dotted keys', () => {
        const out = sanitize({ 'a.b.c': 1, name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('removes object values containing $operator keys', () => {
        const out = sanitize({ filter: { $ne: null }, name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });

    test('strips $ keys inside array elements', () => {
        const out = sanitize({ answers: [{ $ne: 1 }, { text: 'ok' }] });
        expect(out.answers[0]).not.toHaveProperty('$ne');
        expect(out.answers[1]).toEqual({ text: 'ok' });
    });

    test('deeply nested operator is stripped', () => {
        const out = sanitize({ a: { b: { $gt: '' } } });
        expect(out.a).not.toHaveProperty('b');
    });

    test('preserves valid nested objects', () => {
        const out = sanitize({ user: { name: 'a', prefs: { lang: 'ko' } } });
        expect(out).toEqual({ user: { name: 'a', prefs: { lang: 'ko' } } });
    });

    test('preserves arrays of strings', () => {
        const out = sanitize({ tags: ['a', 'b', 'c'] });
        expect(out).toEqual({ tags: ['a', 'b', 'c'] });
    });

    test('handles null/undefined/primitives safely', () => {
        expect(sanitize(null)).toBeNull();
        expect(sanitize(undefined)).toBeUndefined();
        expect(sanitize('string')).toBe('string');
        expect(sanitize(42)).toBe(42);
    });

    test('strips __proto__ and constructor keys', () => {
        const out = sanitize({ __proto__: { admin: true }, constructor: {}, name: 'ok' });
        expect(out).toEqual({ name: 'ok' });
    });
});
