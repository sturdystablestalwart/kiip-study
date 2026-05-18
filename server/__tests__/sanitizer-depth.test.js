// Issue #444 — sanitize() must not blow the stack on adversary-supplied
// deeply-nested objects.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);
const { sanitize } = requireCJS('../middleware/sanitizer.js');

function deepNested(depth) {
    let root = {};
    let cur = root;
    for (let i = 0; i < depth; i++) {
        cur.a = {};
        cur = cur.a;
    }
    return root;
}

describe('Issue #444 — sanitizer recursion depth limit', () => {
    it('does not throw RangeError on 10,000-deep nested object', () => {
        const deep = deepNested(10_000);
        expect(() => sanitize(deep)).not.toThrow();
    });

    it('still strips $-keys at root', () => {
        const o = { $where: 'evil', good: 1 };
        sanitize(o);
        expect(o).toEqual({ good: 1 });
    });

    it('still strips $-key-bearing sub-objects at modest depth (3)', () => {
        // Existing behavior (#130): when a nested object contains a Mongo
        // operator key, the entire sub-object is deleted, not just the key.
        const o = { a: { b: { c: { $where: 'evil', good: 1 } } } };
        sanitize(o);
        expect(o.a.b.c).toBeUndefined();
    });

    it('strips bare $-keys at any depth', () => {
        const o = { a: { $evil: 1, ok: 2 } };
        sanitize(o);
        expect(o.a).toEqual({ ok: 2 });
    });

    it('preserves non-malicious deep structure (under cap)', () => {
        const o = { a: { b: { c: 'value' } } };
        sanitize(o);
        expect(o.a.b.c).toBe('value');
    });

    it('does not throw on a wide array of nested objects', () => {
        const arr = [];
        for (let i = 0; i < 1000; i++) arr.push({ k: i, nested: { x: i } });
        expect(() => sanitize(arr)).not.toThrow();
        expect(arr[42].nested.x).toBe(42);
    });
});
