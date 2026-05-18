// Issue #464 — useCountdownTimer anchors on Date.now() so a long
// elapsed window (e.g. backgrounded tab, laptop sleep) snaps the
// displayed timeLeft to the correct value instead of slow-walking
// down by 1 per tick.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCountdownTimer from '../useCountdownTimer';

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false, now: new Date('2026-05-18T00:00:00Z') });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('Issue #464 — wall-clock anchored countdown', () => {
    it('initial timeLeft equals initialSeconds', () => {
        const { result } = renderHook(() => useCountdownTimer({ initialSeconds: 1800, active: true }));
        expect(result.current.timeLeft).toBe(1800);
    });

    it('after 10 seconds of wall clock, timeLeft is 1790 regardless of throttling', () => {
        const { result } = renderHook(() => useCountdownTimer({ initialSeconds: 1800, active: true }));
        act(() => {
            vi.advanceTimersByTime(10_000);
        });
        expect(result.current.timeLeft).toBe(1790);
    });

    it('after 600 wall-clock seconds, timeLeft is 1200 even if interval throttled to 1 tick', () => {
        const { result } = renderHook(() => useCountdownTimer({ initialSeconds: 1800, active: true }));
        act(() => {
            vi.advanceTimersByTime(600_000);
        });
        expect(result.current.timeLeft).toBe(1200);
    });

    it('expires + sets overdueSeconds correctly when wall clock passes initial', () => {
        const { result } = renderHook(() => useCountdownTimer({ initialSeconds: 5, active: true }));
        act(() => {
            vi.advanceTimersByTime(8_000);
        });
        expect(result.current.timeLeft).toBe(0);
        expect(result.current.expired).toBe(true);
        expect(result.current.overdueSeconds).toBe(3);
    });

    it('setTimeLeft (resume) re-anchors and counts from the new value', () => {
        const { result } = renderHook(() => useCountdownTimer({ initialSeconds: 1800, active: true }));
        act(() => { result.current.setTimeLeft(120); });
        expect(result.current.timeLeft).toBe(120);
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(result.current.timeLeft).toBe(90);
    });
});
