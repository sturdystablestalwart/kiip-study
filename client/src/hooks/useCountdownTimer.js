// Issue #24 — extract TestTaker's countdown effect into a reusable
// hook.  Returns the current time-left + overdue-seconds + expired flag
// and the function to reset the timer if the page reloads with a saved
// session.
//
//   const { timeLeft, overdueSeconds, expired, setTimeLeft } =
//       useCountdownTimer({ initialSeconds: 30 * 60, active: !isSubmitted && !!test });
//
// Owns its own setInterval — the host page no longer needs to.
import { useEffect, useRef, useState } from 'react';

export default function useCountdownTimer({ initialSeconds, active }) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const [overdueSeconds, setOverdueSeconds] = useState(0);
    const [expired, setExpired] = useState(false);
    // Active flag captured in a ref so changing it doesn't restart
    // the interval; the tick callback reads the live value.
    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);

    useEffect(() => {
        if (!active) return undefined;
        const id = setInterval(() => {
            if (!activeRef.current) return;
            setTimeLeft(prev => {
                if (prev <= 0) {
                    setExpired(true);
                    setOverdueSeconds(os => os + 1);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [active]);

    return { timeLeft, overdueSeconds, expired, setTimeLeft };
}
