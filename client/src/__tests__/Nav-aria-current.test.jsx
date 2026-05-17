/**
 * Regression for issue #78:
 * Top-nav links use color/weight to mark the active route but never set
 * `aria-current="page"`, so screen readers can't announce the current page.
 * NavLinks ARE `styled(Link)` (not RR's auto-aria NavLink), so the prop has
 * to be passed explicitly.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const { I18N_OBJ, AUTH_OBJ, THEME_OBJ, apiGetMock } = vi.hoisted(() => ({
  I18N_OBJ: {
    t: (key) => key,
    i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: () => Promise.resolve() },
  },
  AUTH_OBJ: { user: null, loading: false, logout: () => {} },
  THEME_OBJ: { isDark: false, toggleMode: () => {} },
  apiGetMock: vi.fn(() => Promise.resolve({ data: { openCount: 0 } })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], updateServiceWorker: () => {} }),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => AUTH_OBJ }));
vi.mock('../context/ThemeContext', () => ({ useThemeMode: () => THEME_OBJ }));
vi.mock('../utils/api', () => ({ default: { get: apiGetMock } }));

import { Navigation } from '../App';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider theme={lightTheme}>
        <Navigation onSignIn={() => {}} />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('Nav aria-current="page" (#78)', () => {
  afterEach(() => {
    AUTH_OBJ.user = null;
  });

  it('sets aria-current="page" on the Home link when on /', () => {
    renderAt('/');
    const home = screen.getByRole('link', { name: 'nav.home' });
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('marks Dashboard as current and clears Home when on /dashboard', () => {
    AUTH_OBJ.user = { _id: 'u1', isAdmin: false };
    renderAt('/dashboard');
    const home = screen.getByRole('link', { name: 'nav.home' });
    expect(home).not.toHaveAttribute('aria-current');
    const dash = screen.getByRole('link', { name: 'nav.dashboard' });
    expect(dash).toHaveAttribute('aria-current', 'page');
  });
});
