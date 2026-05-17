import { useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap keyboard focus inside `ref.current` while `active`.
 *
 * Issue #178 — a modal that swaps its inner content (e.g. AuthModal
 * transitioning from `idle` to `checkEmail`) used to break the trap:
 * the initial focusable-scan ran once on mount, and after a content
 * swap that scan might have been empty (the new buttons hadn't
 * mounted yet) so Tab fell through to the document body.
 *
 * Now we attach a MutationObserver to the trapped container.  Each
 * time children mutate AND nothing inside the trap currently has
 * focus, we re-focus the first focusable element.
 */
export default function useFocusTrap(ref, active = true) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const previouslyFocused = document.activeElement;

    const getFocusable = () => [...root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Issue #178 — re-focus the first element when the trapped
    // container's children mutate AND focus has escaped the trap
    // (e.g. landed on body after a content swap removed the
    // previously-focused element).
    const refocusIfEscaped = () => {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      if (!root.contains(document.activeElement)) {
        focusable[0].focus();
      }
    };

    const observer = new MutationObserver(refocusIfEscaped);
    observer.observe(root, { childList: true, subtree: true });

    root.addEventListener('keydown', handleKeyDown);
    const focusable = getFocusable();
    if (focusable.length > 0) focusable[0].focus();

    return () => {
      observer.disconnect();
      root.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [ref, active]);
}
