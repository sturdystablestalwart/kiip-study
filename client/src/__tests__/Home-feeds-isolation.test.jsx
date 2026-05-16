/**
 * Regression test for issue #118:
 * Home fetches three independent feeds (recent attempts, active sessions,
 * review/difficulty) in parallel. With `Promise.all`, a single rejection
 * (e.g. a transient 500 on /api/review/difficulty) caused ALL three pieces
 * of UI state to remain empty — hiding Continue-Session and Recent-Attempts
 * even though those endpoints had succeeded.
 *
 * Fix: switch to `Promise.allSettled` and apply each result independently so
 * one failing feed never hides the others.
 *
 * Repro:
 *   1. Mock /api/sessions/active to return one active session.
 *   2. Mock /api/tests/recent-attempts to return two attempts.
 *   3. Mock /api/review/difficulty to REJECT (simulate 500).
 *   4. Render Home as an authenticated user.
 *   5. Expect active-sessions and the most-recent-attempt CTA to be visible.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// --- Mocks (must come before importing Home) ---

const I18N_OBJ = {
  t: (key, opts) => {
    if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
    return key;
  },
  i18n: { changeLanguage: () => Promise.resolve() },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

const AUTH_OBJ = {
  user: { _id: 'u1', isAdmin: false, displayName: 'User' },
};
vi.mock('../context/AuthContext', () => ({
  useAuth: () => AUTH_OBJ,
}));

const SEARCH_OBJ = { openPalette: () => {} };
vi.mock('../context/SearchPaletteContext', () => ({
  useSearchPalette: () => SEARCH_OBJ,
}));

const apiGetMock = vi.fn();
const apiDeleteMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    delete: (...args) => apiDeleteMock(...args),
    post: (...args) => apiPostMock(...args),
  },
}));

import Home from '../pages/Home';

const renderHome = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('Home: independent user feeds (#118)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiDeleteMock.mockReset();
    apiPostMock.mockReset();
  });

  it('renders active sessions and recent-attempts CTA even when /api/review/difficulty rejects', async () => {
    const session = {
      _id: 's1',
      mode: 'Practice',
      remainingTime: 600,
      testId: { _id: 't1', title: 'Active Session Test' },
    };
    const attempts = [
      {
        _id: 'a1',
        testId: 't1',
        score: 8,
        totalQuestions: 10,
        mode: 'Practice',
        createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
        test: { title: 'Recent Attempt Test', unit: 'U1' },
      },
      {
        _id: 'a2',
        testId: 't2',
        score: 5,
        totalQuestions: 10,
        mode: 'Test',
        createdAt: new Date('2025-12-31T00:00:00Z').toISOString(),
        test: { title: 'Older Attempt', unit: 'U2' },
      },
    ];

    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/curriculum')) return Promise.resolve({ data: [] });
      if (url.startsWith('/api/tests/recent-attempts')) {
        return Promise.resolve({ data: attempts });
      }
      if (url.startsWith('/api/sessions/active')) {
        return Promise.resolve({ data: { sessions: [session] } });
      }
      if (url.startsWith('/api/review/difficulty')) {
        const err = new Error('Internal Server Error');
        err.response = { status: 500, data: { message: 'boom' } };
        return Promise.reject(err);
      }
      if (url.startsWith('/api/tests?')) {
        return Promise.resolve({ data: { tests: [], nextCursor: null, total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    renderHome();

    // Active session CTA must still render despite the difficulty feed failing.
    await waitFor(() => {
      expect(screen.getByTestId('active-sessions')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.getByText('Active Session Test')).toBeInTheDocument();

    // The most-recent attempt's "Continue" card must still render.
    expect(screen.getByText('Recent Attempt Test')).toBeInTheDocument();
  });
});
