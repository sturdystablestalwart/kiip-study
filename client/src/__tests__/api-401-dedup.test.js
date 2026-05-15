/**
 * Regression test for issue #121:
 * The axios response interceptor in `client/src/utils/api.js` fires a
 * "session expired" toast and dispatches an `auth:expired` event on every
 * 401 response. When the session cookie expires, N parallel in-flight
 * requests all return 401 simultaneously, so the user sees the same banner
 * stacked N times and AuthContext state gets cleared N times.
 *
 * Fix: a module-scoped latch dedups the side effects for ~5s after the
 * first 401, then clears so a future expiry can fire again.
 *
 * We exercise the actual installed response interceptor by reading
 * `api.interceptors.response.handlers[0].rejected` and feeding it synthesized
 * axios error objects directly — no network, no axios-mock-adapter.
 */

import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';

// ---- Mocks (must come before importing api) ----

vi.mock('../components/Toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../i18n', () => ({
  default: {
    t: (key) => key,
  },
}));

// Stable base URL so api.js can import it without surprises.
vi.mock('../config/api', () => ({
  default: 'http://localhost:5000',
}));

describe('api.js 401 interceptor dedup (#121)', () => {
  let api;
  let showToast;
  let dispatchSpy;
  let rejectedHandler;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Re-import fresh so the module-scoped latch resets between tests.
    vi.resetModules();
    const mod = await import('../utils/api.js');
    api = mod.default;
    showToast = (await import('../components/Toast')).showToast;
    showToast.mockClear();
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    // Grab the installed rejected handler from the response interceptor.
    const handlers = api.interceptors.response.handlers.filter(Boolean);
    expect(handlers.length).toBeGreaterThan(0);
    rejectedHandler = handlers[0].rejected;
    expect(typeof rejectedHandler).toBe('function');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.useRealTimers();
  });

  /** Build a minimal axios error shape that the interceptor will read. */
  function err401(url = '/api/tests') {
    return {
      isAxiosError: true,
      response: { status: 401, data: {} },
      config: { url },
      code: undefined,
    };
  }

  function countAuthExpired() {
    return dispatchSpy.mock.calls.filter(
      ([ev]) => ev && ev.type === 'auth:expired'
    ).length;
  }

  it('fires showToast + auth:expired exactly once for N parallel 401s', async () => {
    const N = 5;
    const rejections = Array.from({ length: N }, () =>
      rejectedHandler(err401('/api/tests')).catch(() => {})
    );
    await Promise.all(rejections);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      'common.sessionExpired',
      'warning',
      6000
    );
    expect(countAuthExpired()).toBe(1);
  });

  it('does not fire toast for /api/auth/me 401 (silent probe)', async () => {
    await rejectedHandler(err401('/api/auth/me')).catch(() => {});
    expect(showToast).not.toHaveBeenCalled();
    expect(countAuthExpired()).toBe(0);
  });

  it('re-arms after the 5s window so a fresh expiry can fire again', async () => {
    // First wave
    await Promise.all([
      rejectedHandler(err401()).catch(() => {}),
      rejectedHandler(err401()).catch(() => {}),
      rejectedHandler(err401()).catch(() => {}),
    ]);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(countAuthExpired()).toBe(1);

    // Advance past the 5s latch.
    await vi.advanceTimersByTimeAsync(5001);

    // Second wave should fire again.
    await Promise.all([
      rejectedHandler(err401()).catch(() => {}),
      rejectedHandler(err401()).catch(() => {}),
    ]);
    expect(showToast).toHaveBeenCalledTimes(2);
    expect(countAuthExpired()).toBe(2);
  });

  it('still rejects the error so callers see the original failure', async () => {
    const e = err401();
    await expect(rejectedHandler(e)).rejects.toBe(e);
  });

  it('does not treat axios cancellations as session expiry', async () => {
    // Build a real cancel error shape axios.isCancel recognises.
    const { default: axios } = await import('axios');
    const cancel = new axios.Cancel('canceled');
    await expect(rejectedHandler(cancel)).rejects.toBe(cancel);
    expect(showToast).not.toHaveBeenCalled();
    expect(countAuthExpired()).toBe(0);
  });
});
