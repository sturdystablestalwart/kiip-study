/**
 * Regression test for issue #82:
 * FillInTheBlank inputs hard-coded English `Blank N` (aria-label) and
 * `blank N` (placeholder). Both surfaces must route through i18n so KO/RU/ES
 * screen-reader users hear the localized label.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const I18N_OBJ = {
  t: (key, opts) => {
    if (opts && typeof opts.index === 'number') return `${key}:${opts.index}`;
    return key;
  },
  i18n: { changeLanguage: () => Promise.resolve() },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

import FillInTheBlank from '../components/question-types/FillInTheBlank';

const QUESTION = {
  text: 'The capital of ___ is ___.',
  blanks: [
    { answer: 'France' },
    { answer: 'Paris' },
  ],
};

describe('FillInTheBlank i18n (#82)', () => {
  it('localizes the placeholder and aria-label of each blank', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <FillInTheBlank
          question={QUESTION}
          answer={null}
          onAnswer={() => {}}
          showFeedback={false}
          disabled={false}
        />
      </ThemeProvider>
    );

    expect(screen.getByLabelText('test.blankAriaLabel:1')).toBeInTheDocument();
    expect(screen.getByLabelText('test.blankAriaLabel:2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('test.blankPlaceholder:1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('test.blankPlaceholder:2')).toBeInTheDocument();

    expect(screen.queryByLabelText(/^Blank \d$/)).toBeNull();
    expect(screen.queryByPlaceholderText(/^blank \d$/)).toBeNull();
  });
});
