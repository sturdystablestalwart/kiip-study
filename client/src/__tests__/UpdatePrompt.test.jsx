/**
 * Regression tests for issue #122:
 *
 * The PWA is registered with `registerType: 'autoUpdate'` but no UX exposes
 * the new-version state. Users on long sessions (e.g. TestTaker open for
 * 30-60 minutes) get stuck on a stale bundle until every tab is closed.
 *
 * `UpdatePrompt` must:
 *   (A) render a visible "new version available" affordance whenever the
 *       `useRegisterSW` hook from `virtual:pwa-register/react` reports
 *       `needRefresh = true`.
 *   (B) call `updateServiceWorker(true)` when the reload button is clicked,
 *       which triggers skipWaiting + clients.claim under the hood.
 *   (C) be dismissible: clicking the close affordance must clear
 *       `needRefresh` (via `setNeedRefresh(false)`) WITHOUT calling
 *       `updateServiceWorker`. The banner must then disappear.
 *   (D) render nothing when `needRefresh` and `offlineReady` are both false,
 *       so it doesn't take up screen space on the happy path.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// --- Mocks (must come before importing UpdatePrompt) ---

// i18n: mirror the simple pass-through used elsewhere in the suite so the
// banner copy is deterministic.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}));

// `virtual:pwa-register/react` is supplied by vite-plugin-pwa at build time;
// vitest must be told what to return. We expose a mutable record so each
// test can reconfigure the mock before mounting.
const mockRegister = {
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(),
};
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockRegister.needRefresh, mockRegister.setNeedRefresh],
    offlineReady: [mockRegister.offlineReady, mockRegister.setOfflineReady],
    updateServiceWorker: mockRegister.updateServiceWorker,
  }),
}));

// Import AFTER the mocks above.
import UpdatePrompt from '../components/UpdatePrompt';

const renderPrompt = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <UpdatePrompt />
    </ThemeProvider>
  );

describe('UpdatePrompt (#122): new-version banner', () => {
  beforeEach(() => {
    mockRegister.needRefresh = false;
    mockRegister.offlineReady = false;
    mockRegister.setNeedRefresh.mockReset();
    mockRegister.setOfflineReady.mockReset();
    mockRegister.updateServiceWorker.mockReset();
  });

  it('(A) shows a reload affordance when needRefresh is true', () => {
    mockRegister.needRefresh = true;
    renderPrompt();

    // The user must see something explaining a new version is ready.
    const reloadBtn = screen.getByRole('button', { name: /reload/i });
    expect(reloadBtn).toBeInTheDocument();

    // The banner itself should be flagged as an alert/status region so SRs
    // pick it up.
    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent(/new version|update/i);
  });

  it('(B) calls updateServiceWorker(true) when the reload button is clicked', () => {
    mockRegister.needRefresh = true;
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: /reload/i }));

    expect(mockRegister.updateServiceWorker).toHaveBeenCalledTimes(1);
    expect(mockRegister.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('(C) is dismissible: clicking close clears needRefresh without reloading', () => {
    mockRegister.needRefresh = true;
    renderPrompt();

    const closeBtn = screen.getByRole('button', { name: /close|dismiss/i });
    fireEvent.click(closeBtn);

    // Dismiss must NOT trigger an SW activation.
    expect(mockRegister.updateServiceWorker).not.toHaveBeenCalled();
    // It must clear the needRefresh flag so the banner unmounts.
    expect(mockRegister.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('(D) renders nothing when there is no new version and no offline-ready notice', () => {
    mockRegister.needRefresh = false;
    mockRegister.offlineReady = false;
    const { container } = renderPrompt();

    // No status region should be present on the happy path.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: /reload/i })).toBeNull();
    // Container should be empty (no DOM noise).
    expect(container.firstChild).toBeNull();
  });
});
