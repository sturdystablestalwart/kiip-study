/**
 * Regression for issue #81:
 * MCQMultiple rendered "Select all that apply" as a hard-coded English
 * HintText and aria-label. Both surfaces must route through i18n.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const I18N_OBJ = {
  t: (key) => key,
  i18n: { changeLanguage: () => Promise.resolve() },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

import MCQMultiple from '../components/question-types/MCQMultiple';

const QUESTION = {
  options: [
    { text: 'A', isCorrect: true },
    { text: 'B', isCorrect: false },
    { text: 'C', isCorrect: true },
  ],
};

describe('MCQMultiple i18n (#81)', () => {
  it('routes the hint and group aria-label through i18n', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <MCQMultiple
          question={QUESTION}
          answer={null}
          onAnswer={() => {}}
          showFeedback={false}
          disabled={false}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('test.selectAllThatApply')).toBeInTheDocument();
    expect(screen.getByLabelText('test.selectAllThatApplyAriaLabel')).toBeInTheDocument();

    expect(screen.queryByText(/Select all that apply/i)).toBeNull();
    expect(screen.queryByLabelText(/Answer options/i)).toBeNull();
  });
});
