/**
 * Regression for issue #83:
 * ShortAnswer feedback messages "Correct!" and "Incorrect. Accepted answers:"
 * were hard-coded English. Both must route through i18n.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

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

import ShortAnswer from '../components/question-types/ShortAnswer';

const QUESTION = { acceptedAnswers: ['Paris'] };

function renderSA(props) {
  return render(
    <ThemeProvider theme={lightTheme}>
      <ShortAnswer
        question={QUESTION}
        onAnswer={() => {}}
        showFeedback
        disabled
        {...props}
      />
    </ThemeProvider>
  );
}

describe('ShortAnswer feedback i18n (#83)', () => {
  it('routes the correct-feedback through i18n', () => {
    renderSA({ answer: { textAnswer: 'Paris' } });

    expect(screen.getByText('test.feedbackCorrect')).toBeInTheDocument();
    expect(screen.queryByText(/^Correct!$/)).toBeNull();
  });

  it('routes the incorrect-feedback prefix through i18n when an answer is provided', () => {
    renderSA({ answer: { textAnswer: 'London' } });

    expect(screen.getByText('test.feedbackIncorrectAccepted')).toBeInTheDocument();
    expect(screen.queryByText(/^Incorrect/)).toBeNull();
  });
});
