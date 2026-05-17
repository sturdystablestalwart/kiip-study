/**
 * Regression for issue #44:
 * Forms across the app set $hasError styled-components state for visual
 * error feedback but never linked the error message to the input via
 * aria-describedby + role="alert".  Screen-reader users hear "invalid"
 * with no context.  Verify CreateTest's textarea wires both attrs.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const I18N_OBJ = {
  t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  i18n: { changeLanguage: () => Promise.resolve(), language: 'en', resolvedLanguage: 'en' },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

vi.mock('../utils/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

import CreateTest from '../pages/CreateTest';

const wrap = (ui) => render(
  <MemoryRouter>
    <ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>
  </MemoryRouter>
);

describe('CreateTest aria-describedby for inline errors (#44)', () => {
  it('TextArea exposes aria-invalid and aria-describedby pointing to a live error region', () => {
    wrap(<CreateTest />);
    const textarea = screen.getByPlaceholderText('create.textPlaceholder');

    fireEvent.change(textarea, { target: { value: 'abc' } });

    expect(textarea.getAttribute('aria-invalid')).toBe('true');

    const describedBy = textarea.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const errorRegion = document.getElementById(describedBy);
    expect(errorRegion).not.toBeNull();
    expect(errorRegion.getAttribute('role')).toBe('alert');
  });

  it('TextArea aria-invalid clears once enough characters are typed', () => {
    wrap(<CreateTest />);
    const textarea = screen.getByPlaceholderText('create.textPlaceholder');

    fireEvent.change(textarea, { target: { value: 'a'.repeat(250) } });
    expect(textarea.getAttribute('aria-invalid')).toBe('false');
  });
});
