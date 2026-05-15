/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';

const slideIn = keyframes`
  from { transform: translateX(-50%) translateY(100%); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(-50%) translateY(0);    opacity: 1; }
  to   { transform: translateX(-50%) translateY(100%); opacity: 0; }
`;

const ToastContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.layout.space[6]}px;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${({ theme }) => theme.zIndex.toast};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  pointer-events: none;
  align-items: center;
`;

const ToastItem = styled.div`
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-left: 4px solid ${({ $type, theme }) => {
    if ($type === 'success') return theme.colors.state.success;
    if ($type === 'error') return theme.colors.state.danger;
    if ($type === 'warning') return theme.colors.state.warning;
    return theme.colors.accent.indigo;
  }};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
  animation: ${({ $exiting }) => $exiting ? slideOut : slideIn}
             ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease} forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DismissButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  padding: ${({ theme }) => theme.layout.space[2]}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: 1;
  flex-shrink: 0;
  font-family: inherit;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.focus.ring};
    outline-offset: 2px;
  }
`;

let toastIdCounter = 0;

// Maximum number of visible toasts at any time. Prevents a 401/retry storm
// from filling the viewport (#120B).
const MAX_TOASTS = 5;
// Window during which identical (message, type) pairs are deduped (#120C).
const DEDUP_WINDOW_MS = 1000;
// Exit-animation duration; must match keyframes timing above.
const EXIT_ANIM_MS = 160;

export function showToast(message, type = 'info', duration = 5000) {
  window.dispatchEvent(new CustomEvent('toast:show', {
    detail: { id: ++toastIdCounter, message, type, duration }
  }));
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  // Track every active setTimeout so we can clear them on unmount and avoid
  // setState-after-unmount + memory leaks (#120A).
  const timersRef = useRef(new Set());
  // Track recently-shown (type|message) -> timestamp for dedup (#120C).
  const recentRef = useRef(new Map());
  // Guard so timer callbacks don't setState after unmount.
  const mountedRef = useRef(true);

  const scheduleTimer = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (mountedRef.current) fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const startExit = useCallback((id) => {
    if (!mountedRef.current) return;
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    scheduleTimer(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, EXIT_ANIM_MS);
  }, [scheduleTimer]);

  useEffect(() => {
    mountedRef.current = true;
    // Capture ref values inside the effect so ESLint's exhaustive-deps rule is
    // satisfied and cleanup operates on the same Set/Map instances.
    const timers = timersRef.current;
    const recent = recentRef.current;

    const handler = (e) => {
      const { id, message, type, duration } = e.detail;

      // Dedup: drop if an identical (message, type) was shown within
      // DEDUP_WINDOW_MS. Opportunistically prune stale entries.
      const key = `${type}::${message}`;
      const now = Date.now();
      for (const [k, ts] of recent) {
        if (now - ts > DEDUP_WINDOW_MS) recent.delete(k);
      }
      if (recent.has(key)) return;
      recent.set(key, now);

      setToasts(prev => {
        const next = [...prev, { id, message, type, exiting: false }];
        // Cap the visible queue — drop the oldest entries first.
        if (next.length > MAX_TOASTS) {
          return next.slice(next.length - MAX_TOASTS);
        }
        return next;
      });

      if (duration > 0) {
        scheduleTimer(() => startExit(id), duration);
      }
    };

    window.addEventListener('toast:show', handler);
    return () => {
      window.removeEventListener('toast:show', handler);
      mountedRef.current = false;
      // Clear every pending timer so they can't fire after unmount (#120A).
      for (const tid of timers) clearTimeout(tid);
      timers.clear();
      recent.clear();
    };
  }, [scheduleTimer, startExit]);

  const dismiss = (id) => {
    startExit(id);
  };

  return (
    <ToastContainer role="status" aria-live="polite">
      {toasts.map(toast => (
        <ToastItem key={toast.id} $exiting={toast.exiting} $type={toast.type}>
          {toast.message}
          <DismissButton onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            &times;
          </DismissButton>
        </ToastItem>
      ))}
    </ToastContainer>
  );
}
