/**
 * Regression for issue #80:
 * ShortAnswer rendered the character-count hint as `<n> characters` — the
 * literal English "characters" suffix is ignored by KO/RU/ES users.
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

describe('ShortAnswer charCount i18n (#80)', () => {
  it('routes the character-count hint through i18n', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ShortAnswer
          question={QUESTION}
          answer={{ textAnswer: 'hello' }}
          onAnswer={() => {}}
          showFeedback={false}
          disabled={false}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('test.charCount:5')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ characters$/)).toBeNull();
  });

  it('renders 0 chars when no answer provided', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <ShortAnswer
          question={QUESTION}
          answer={null}
          onAnswer={() => {}}
          showFeedback={false}
          disabled={false}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('test.charCount:0')).toBeInTheDocument();
  });
});
