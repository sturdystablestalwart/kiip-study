/**
 * Regression for issue #169:
 * SharedTest hard-coded "Unit {n}" while Home renders the same field in
 * Korean. Make the public share view localize via `test.unit`.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const { I18N_OBJ, apiGetMock } = vi.hoisted(() => ({
  I18N_OBJ: {
    t: (key, opts) => {
      if (opts && typeof opts.count === 'number') return `${key}:${opts.count}`;
      return key;
    },
    i18n: { changeLanguage: () => Promise.resolve() },
  },
  apiGetMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => I18N_OBJ }));
vi.mock('../utils/api', () => ({ default: { get: apiGetMock } }));

import SharedTest from '../pages/SharedTest';

describe('SharedTest unit i18n (#169)', () => {
  it('renders the unit number through t("test.unit")', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        _id: 't1',
        title: 'Greetings',
        unitNumber: 5,
        level: '1',
        questionCount: 12,
      },
    });

    render(
      <ThemeProvider theme={lightTheme}>
        <MemoryRouter initialEntries={['/share/abc']}>
          <Routes>
            <Route path="/share/:shareId" element={<SharedTest />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );

    await waitFor(() => screen.getByText('Greetings'));
    expect(screen.getByText('test.unit:5')).toBeInTheDocument();
    expect(screen.queryByText('Unit 5')).toBeNull();
  });
});
