/**
 * Regression test for issue #117:
 * Home `confirmDelete` must use a functional setter so that tests loaded via
 * "Load More" after the delete modal opens are not silently dropped when the
 * delete completes.
 *
 * Repro:
 *   1. Render Home with N tests (and a nextCursor so Load More is available).
 *   2. Open the delete modal on one of the N tests.
 *   3. Click "Remove" — `confirmDelete` runs, capturing the current `tests` array.
 *      We hold the `api.delete` promise pending.
 *   4. While the delete is pending, click "Load More" — `tests` grows by 10.
 *   5. Resolve the delete promise.
 *   6. With the buggy code, `setTests(tests.filter(...))` overwrites the array
 *      using the stale (pre-Load-More) closure: 10 items vanish.
 *      With the fix, `setTests(prev => prev.filter(...))` preserves them.
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// --- Mocks (must come before importing Home) ---

// Use stable object identities — Home has effects keyed off `user` and other
// context values; returning fresh objects each render would trigger infinite
// re-renders in jsdom.
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
  user: { _id: 'admin1', isAdmin: true, displayName: 'Admin' },
};
vi.mock('../context/AuthContext', () => ({
  useAuth: () => AUTH_OBJ,
}));

const SEARCH_OBJ = { openPalette: () => {} };
vi.mock('../context/SearchPaletteContext', () => ({
  useSearchPalette: () => SEARCH_OBJ,
}));

// Mock the api module — Home imports it as default export.
const apiGetMock = vi.fn();
const apiDeleteMock = vi.fn();
vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    delete: (...args) => apiDeleteMock(...args),
  },
}));

import Home from '../pages/Home';

const makeTest = (i) => ({
  _id: `t${i}`,
  title: `Test ${i}`,
  level: '2',
  unitNumber: i,
  questionCount: 10,
  contentType: 'mock-exam',
});

const renderHome = () =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('Home: confirmDelete does not drop tests loaded after modal opens (#117)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiDeleteMock.mockReset();
  });

  it('preserves tests loaded via Load More while delete request is in flight', async () => {
    const initial = Array.from({ length: 5 }, (_, i) => makeTest(i + 1));
    const more = Array.from({ length: 10 }, (_, i) => makeTest(i + 6));

    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/curriculum')) return Promise.resolve({ data: [] });
      if (url.startsWith('/api/tests/recent-attempts'))
        return Promise.resolve({ data: [] });
      if (url.startsWith('/api/sessions/active'))
        return Promise.resolve({ data: { sessions: [] } });
      if (url.startsWith('/api/review/difficulty'))
        return Promise.resolve({ data: { difficulty: {} } });
      if (url.startsWith('/api/tests?')) {
        if (url.includes('cursor=cursor1')) {
          return Promise.resolve({
            data: { tests: more, nextCursor: null, total: 15 },
          });
        }
        return Promise.resolve({
          data: { tests: initial, nextCursor: 'cursor1', total: 15 },
        });
      }
      return Promise.resolve({ data: {} });
    });

    // Hold the delete promise so we can interleave Load More between the
    // click on "Remove" and the resolution of the delete request.
    let resolveDelete;
    apiDeleteMock.mockImplementation(
      () => new Promise((resolve) => { resolveDelete = resolve; })
    );

    renderHome();

    // Wait for the initial 5 cards to be rendered.
    const deleteBtn5 = await screen.findByLabelText('Delete Test 5', {}, { timeout: 4000 });
    expect(deleteBtn5).toBeInTheDocument();

    // Open delete modal on Test 5.
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete Test 5'));
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click "Remove" — kicks off confirmDelete (api.delete is pending).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    });

    // While delete is pending, click Load More — tests grows to 15.
    // Load More button label comes from t('home.loadMore') which our mock
    // returns as the key.
    const loadMoreBtn = await screen.findByRole('button', { name: 'home.loadMore' });
    await act(async () => {
      fireEvent.click(loadMoreBtn);
    });

    // Wait until the 10 new cards appear (state has grown to 15).
    await waitFor(() => {
      expect(screen.getByLabelText('Delete Test 15')).toBeInTheDocument();
    });
    // Test 5 is still present (delete hasn't resolved yet).
    expect(screen.getByLabelText('Delete Test 5')).toBeInTheDocument();

    // Now resolve the delete.
    await act(async () => {
      resolveDelete({ data: { ok: true } });
    });

    // After the delete resolves, Test 5 should be gone, but all 10 newly loaded
    // tests (6..15) MUST still be present. With the buggy stale-closure code,
    // they would all disappear.
    await waitFor(() => {
      expect(screen.queryByLabelText('Delete Test 5')).not.toBeInTheDocument();
    });

    for (let i = 1; i <= 15; i++) {
      if (i === 5) continue;
      expect(
        screen.getByLabelText(`Delete Test ${i}`),
        `Test ${i} should still be in the list after delete`
      ).toBeInTheDocument();
    }
  }, 20000);
});
