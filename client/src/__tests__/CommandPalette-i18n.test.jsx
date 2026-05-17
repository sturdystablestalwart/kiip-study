/**
 * Regression test for issue #79:
 * CommandPalette result rows must localize the question-count suffix.
 * Before the fix: `{test.questionCount} qs` — English literal in all locales.
 * After:         `{t('home.questionsCount', { count })}`.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';
import { lightTheme } from '../theme/tokens';

// Identity-stable mock so React effects don't oscillate.
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

const apiGetMock = vi.fn();
vi.mock('../utils/api', () => ({
  default: { get: (...args) => apiGetMock(...args) },
}));

import CommandPalette from '../components/CommandPalette';

function renderPalette() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={lightTheme}>
        <CommandPalette onClose={() => {}} />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('CommandPalette i18n (#79)', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({
      data: {
        tests: [
          { _id: 't1', title: 'Alpha', questionCount: 7 },
          { _id: 't2', title: 'Beta', questionCount: 1 },
        ],
      },
    });
  });

  it('renders the question-count meta via the home.questionsCount i18n key (no hard-coded "qs")', async () => {
    renderPalette();

    const input = screen.getByPlaceholderText('nav.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'a' } });

    // Drive debounce + async fetch
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled(), { timeout: 1500 });
    await waitFor(() => screen.getByText('Alpha'));

    expect(screen.getByText('home.questionsCount:7')).toBeInTheDocument();
    expect(screen.getByText('home.questionsCount:1')).toBeInTheDocument();
    expect(screen.queryByText(/\bqs\b/)).toBeNull();
  });
});
