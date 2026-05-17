import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { sanitize, sanitizeMiddleware } = require('../sanitizer');

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

// Issue #130 — middleware and recursive helper must behave identically
// at every depth so future contributors don't need to memorise two sets
// of rules.  These tests pin the contract: the middleware applies the
// SAME sanitize() at root and nested levels for body / params / query.
describe('sanitizeMiddleware applies identical rules at every depth', () => {
    function runMiddleware(reqLike) {
        let called = false;
        sanitizeMiddleware(reqLike, undefined, () => { called = true; });
        if (!called) throw new Error('next() not called');
        return reqLike;
    }

    test('body: strips $-keys and operator-objects at any nesting depth', () => {
        const req = {
            body: {
                $where: 'evil',                    // root $-key
                user: { profile: { $gt: 'x' } },   // nested operator-object
                tag: 'ok',
            },
        };
        const out = runMiddleware(req);
        expect(out.body).toEqual({ user: {}, tag: 'ok' });
    });

    test('params: dotted keys are stripped at every depth', () => {
        const req = { params: { 'a.b': 1, nested: { 'c.d': 2, ok: 3 } } };
        const out = runMiddleware(req);
        expect(out.params).toEqual({ nested: { ok: 3 } });
    });

    test('query: root $foo is stripped AND nested {$gt:...} value is stripped (parity check)', () => {
        const req = { query: { $unsafe: 'x', filter: { $gt: 0 }, ok: 'y' } };
        const out = runMiddleware(req);
        expect(out.query).toEqual({ ok: 'y' });
    });

    test('query: nested $-keys (non-MONGO_OPS) are stripped at any depth — parity with body/params', () => {
        // $unknownop is NOT in MONGO_OPS, so the "delete the value-object"
        // branch doesn't fire — only the "strip key starting with $" branch
        // should.  Pre-refactor, root-level + nested behaviour had to match
        // by code duplication; post-refactor, both delegate to the same
        // sanitize() so this is enforced structurally.
        const req = { query: { deep: { wrap: { ok: { $unknownop: 1, kept: 2 } } } } };
        const out = runMiddleware(req);
        expect(out.query.deep.wrap.ok).toEqual({ kept: 2 });
    });
});
