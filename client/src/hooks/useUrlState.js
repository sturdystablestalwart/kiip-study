import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Issue #47 — read/write a single search-param as React state so a
 * filter / pagination value survives refresh, is shareable via URL,
 * and the browser Back button restores it.
 *
 *   const [level, setLevel] = useUrlState('level', '');
 *
 * Empty / default values are removed from the URL so we don't pollute
 * it with `?level=`.  setValue accepts either a value or a (prev) => next
 * function shape, mirroring useState.
 */
export default function useUrlState(key, defaultValue = '') {
    const [searchParams, setSearchParams] = useSearchParams();
    const value = searchParams.get(key) ?? defaultValue;

    const setValue = useCallback((next) => {
        const resolved = typeof next === 'function' ? next(searchParams.get(key) ?? defaultValue) : next;
        setSearchParams((prev) => {
            const out = new URLSearchParams(prev);
            if (resolved == null || resolved === '' || resolved === defaultValue) {
                out.delete(key);
            } else {
                out.set(key, String(resolved));
            }
            return out;
        }, { replace: true });
    }, [key, defaultValue, searchParams, setSearchParams]);

    return [value, setValue];
}
