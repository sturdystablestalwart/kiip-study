/**
 * Regression tests for issue #120:
 * Toast component must
 *   (A) clear pending setTimeouts on unmount so it doesn't call setState on
 *       an unmounted component (no "update on unmounted" console.error),
 *   (B) cap the visible queue at MAX_TOASTS (5) so a 401 storm / retry loop
 *       cannot fill the viewport,
 *   (C) dedupe identical (message, type) pairs fired within 1s of each other.
 *
 * The public API is preserved: `showToast(message, type, duration)` still
 * dispatches a `toast:show` CustomEvent on `window`.
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';
import Toast, { showToast } from '../components/Toast';

const renderToast = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <Toast />
    </ThemeProvider>
  );

describe('Toast (#120): timer leak, queue cap, dedup', () => {
  let errorSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    errorSpy.mockRestore();
  });

  it('(A) clears pending timers on unmount and does not setState after unmount', () => {
    const { unmount } = renderToast();

    // Fire a toast with a finite duration -> two nested setTimeouts will be
    // scheduled (one for "start exit animation" after `duration`, one for
    // "remove from queue" 160ms after that).
    act(() => {
      showToast('hello', 'info', 5000);
    });

    // Visible right after dispatch.
    expect(screen.getByText('hello')).toBeInTheDocument();

    // Unmount BEFORE either timer has had a chance to fire.
    unmount();

    // Now advance the clock past the full lifecycle of both nested timeouts.
    // With the buggy code, the timeouts still fire and call setToasts on an
    // unmounted component -> React logs a "Can't perform a React state update
    // on an unmounted component" error (or in newer React, a warning routed
    // through console.error).
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    const unmountedUpdateWarnings = errorSpy.mock.calls.filter((args) =>
      args.some(
        (a) =>
          typeof a === 'string' &&
          (a.includes('unmounted component') ||
            a.includes('memory leak') ||
            a.includes("Can't perform a React state update"))
      )
    );
    expect(unmountedUpdateWarnings).toEqual([]);
  });

  it('(B) caps visible toast count at MAX_TOASTS (5) under a flood', () => {
    renderToast();

    act(() => {
      for (let i = 0; i < 10; i++) {
        // Vary the message so dedup does NOT collapse them — we want to test
        // the queue cap, not dedup.
        showToast(`flood-${i}`, 'error', 5000);
      }
    });

    // Count rendered items by checking each unique message.
    const visible = [];
    for (let i = 0; i < 10; i++) {
      if (screen.queryByText(`flood-${i}`)) visible.push(i);
    }
    expect(visible.length).toBeLessThanOrEqual(5);
    expect(visible.length).toBeGreaterThan(0);
  });

  it('(C) dedupes identical (message, type) fired within 1s', () => {
    renderToast();

    act(() => {
      showToast('Session expired', 'error', 5000);
      showToast('Session expired', 'error', 5000);
      showToast('Session expired', 'error', 5000);
    });

    // Should render only one copy.
    const matches = screen.queryAllByText('Session expired');
    expect(matches.length).toBe(1);

    // After 1.1s, an identical toast should be allowed again.
    act(() => {
      vi.advanceTimersByTime(1100);
      showToast('Session expired', 'error', 5000);
    });

    // Now we should have a second visible copy (the original is still on
    // screen because its 5s duration hasn't elapsed yet).
    const matchesAfter = screen.queryAllByText('Session expired');
    expect(matchesAfter.length).toBe(2);
  });
});
