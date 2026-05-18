// Issue #24 — extract TestTaker's countdown effect into a reusable
// hook.  Returns the current time-left + overdue-seconds + expired
// flag and the function to reset the timer if the page reloads with
// a saved session.
//
//   const { timeLeft, overdueSeconds, expired, setTimeLeft } =
//       useCountdownTimer({ initialSeconds: 30 * 60, active: !isSubmitted && !!test });
//
// Issue #464 — anchor on Date.now() wall clock instead of
// incrementing per setInterval tick. Backgrounded tabs throttle
// setInterval (Chrome down to 1/min after 5 minutes; can stop
// entirely on power-save). Laptop sleep skips elapsed time
// entirely. Wall-clock anchor + visibilitychange re-tick keeps the
// UI honest regardless of OS / browser throttling.
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useCountdownTimer({ initialSeconds, active }) {
    const [timeLeft, _setTimeLeft] = useState(initialSeconds);
    const [overdueSeconds, setOverdueSeconds] = useState(0);
    const [expired, setExpired] = useState(false);

    // Anchor: (epoch ms when we started counting, timeLeft at that
    // moment). On every tick we compute displayed timeLeft from
    // wall-clock delta against this anchor instead of decrementing.
    const anchorRef = useRef({ startMs: Date.now(), startTimeLeft: initialSeconds });

    // Reset the anchor whenever the consumer overrides timeLeft
    // (e.g. session resume in TestTaker sets it to session.remainingTime).
    const setTimeLeft = useCallback((value) => {
        const next = typeof value === 'function' ? value(anchorRef.current.startTimeLeft) : value;
        anchorRef.current = { startMs: Date.now(), startTimeLeft: next };
        _setTimeLeft(next);
    }, []);

    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);

    useEffect(() => {
        if (!active) return undefined;

        // Reset the anchor whenever active flips on so the timer
        // resumes from the current displayed timeLeft, not from a
        // stale prior anchor.
        anchorRef.current = { startMs: Date.now(), startTimeLeft: timeLeft };

        const tick = () => {
            if (!activeRef.current) return;
            const { startMs, startTimeLeft } = anchorRef.current;
            const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
            const nextLeft = Math.max(0, startTimeLeft - elapsed);
            if (nextLeft === 0) {
                const overdue = Math.max(0, elapsed - startTimeLeft);
                setExpired(true);
                setOverdueSeconds(overdue);
                _setTimeLeft(0);
            } else {
                _setTimeLeft(nextLeft);
            }
        };
        tick(); // snap immediately so the displayed value is current
        const id = setInterval(tick, 1000);

        // Re-tick when the tab returns to the foreground so the
        // displayed time snaps to the truth instead of resuming from
        // a stale throttled value.
        const onVisibility = () => { if (document.visibilityState === 'visible') tick(); };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }
        return () => {
            clearInterval(id);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return { timeLeft, overdueSeconds, expired, setTimeLeft };
}
