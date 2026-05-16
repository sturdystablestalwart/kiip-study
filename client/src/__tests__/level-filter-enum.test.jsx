/**
 * Regression test for issue #113:
 *
 * EndlessMode and AdminDuplicates render a level filter dropdown.  The values
 * sent to the API MUST match the server `Test.level` enum
 * (`'0' | '1' | '2' | '3' | '4' | '5-basic' | '5-advanced'`) — not the human
 * label like "Level 1".  With the buggy code the dropdown options were
 * `['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']` and the filter
 * was silently ignored by the server.
 *
 * These tests mock axios, drive the filter dropdown to "Level 1", trigger the
 * request, and assert the URL carries `level=1` (canonical enum value).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

// --- Mocks (must come before importing the pages under test) ---

const I18N_OBJ = {
  t: (key) => key,
  i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

const AUTH_OBJ = {
  user: { _id: 'admin1', isAdmin: true, displayName: 'Admin' },
  loading: false,
};
vi.mock('../context/AuthContext', () => ({
  useAuth: () => AUTH_OBJ,
}));

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
vi.mock('../utils/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
  },
}));

import EndlessMode from '../pages/EndlessMode';
import AdminDuplicates from '../pages/AdminDuplicates';

const renderWithProviders = (ui) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );

describe('Level filter sends canonical server enum values (#113)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
  });

  it('EndlessMode sends level=1 (not "Level 1") when "Level 1" is selected', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/tests/endless')) {
        return Promise.resolve({ data: { questions: [], remaining: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<EndlessMode />);

    // The level dropdown uses aria-label="home.allLevels" (i18n key passthrough)
    const levelSelect = await screen.findByLabelText('home.allLevels');
    expect(levelSelect).toBeInTheDocument();

    // The option *display label* should still be human-friendly ("Level 1"),
    // but the option *value* MUST be the server enum value ("1").
    const level1Option = Array.from(levelSelect.options).find(
      (opt) => opt.textContent.trim() === 'Level 1'
    );
    expect(level1Option, '"Level 1" option must exist').toBeTruthy();
    expect(
      level1Option.value,
      '"Level 1" option value must be canonical server enum "1"'
    ).toBe('1');

    // Select it via fireEvent.change.
    await act(async () => {
      fireEvent.change(levelSelect, { target: { value: level1Option.value } });
    });

    // Click Start (button labelled by i18n key "endless.start").
    const startBtn = screen.getByRole('button', { name: 'endless.start' });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      const endlessCalls = apiGetMock.mock.calls.filter(([url]) =>
        url.startsWith('/api/tests/endless')
      );
      expect(endlessCalls.length).toBeGreaterThan(0);
    });

    const endlessCall = apiGetMock.mock.calls.find(([url]) =>
      url.startsWith('/api/tests/endless')
    );
    const url = endlessCall[0];

    // The URL must carry the canonical enum value, NOT the human label.
    expect(url, 'URL must contain level=1 (canonical enum)').toMatch(/[?&]level=1(&|$)/);
    expect(url, 'URL must NOT contain level=Level 1 (human label)').not.toMatch(
      /level=Level/
    );
  });

  it('AdminDuplicates sends level=1 (not "Level 1") when "Level 1" is selected and Scan is clicked', async () => {
    apiGetMock.mockImplementation((url) => {
      if (url.startsWith('/api/admin/duplicates')) {
        return Promise.resolve({ data: { clusters: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<AdminDuplicates />);

    // The level dropdown uses aria-label="home.level"
    const levelSelect = await screen.findByLabelText('home.level');
    const level1Option = Array.from(levelSelect.options).find(
      (opt) => opt.textContent.trim() === 'Level 1'
    );
    expect(level1Option, '"Level 1" option must exist').toBeTruthy();
    expect(
      level1Option.value,
      '"Level 1" option value must be canonical server enum "1"'
    ).toBe('1');

    await act(async () => {
      fireEvent.change(levelSelect, { target: { value: level1Option.value } });
    });

    // Click Scan (button text from i18n key "admin.duplicatesScan").
    const scanBtn = screen.getByRole('button', { name: 'admin.duplicatesScan' });
    await act(async () => {
      fireEvent.click(scanBtn);
    });

    await waitFor(() => {
      const scanCalls = apiGetMock.mock.calls.filter(([url]) =>
        url.startsWith('/api/admin/duplicates')
      );
      expect(scanCalls.length).toBeGreaterThan(0);
    });

    const scanCall = apiGetMock.mock.calls.find(([url]) =>
      url.startsWith('/api/admin/duplicates')
    );
    const url = scanCall[0];

    expect(url, 'URL must contain level=1 (canonical enum)').toMatch(/[?&]level=1(&|$)/);
    expect(url, 'URL must NOT contain level=Level 1 (human label)').not.toMatch(
      /level=Level/
    );
  });
});
