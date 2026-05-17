import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Issue #43 — move keyboard focus to the new page's main heading on
 * every route change.  Without this, focus stays on the <a> the user
 * clicked in the nav header and they must tab back through every
 * preceding element to reach the new content (WCAG 2.4.3 / 2.4.1).
 *
 * Looks for the first <h1> inside <main> or [role="main"]; falls back
 * to the first <main>/[role="main"] itself.  Adds tabindex=-1 so
 * non-focusable elements can still receive focus programmatically
 * without becoming part of the natural tab order.
 *
 * Defers via requestAnimationFrame so the new page has mounted before
 * we try to find its heading.
 */
export default function useFocusOnRouteChange() {
    const { pathname } = useLocation();

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const target =
                document.querySelector('main h1, [role="main"] h1') ||
                document.querySelector('main, [role="main"]');
            if (!target) return;
            if (!target.hasAttribute('tabindex')) {
                target.setAttribute('tabindex', '-1');
            }
            target.focus({ preventScroll: false });
        });
        return () => cancelAnimationFrame(id);
    }, [pathname]);
}
