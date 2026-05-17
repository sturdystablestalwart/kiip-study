/**
 * Regression for issue #45:
 * All five question-type renderers (MCQSingle, MCQMultiple, ShortAnswer,
 * Ordering, FillInTheBlank) rendered "<strong>Why?</strong>" as a
 * hard-coded English label in the explanation panel.  Must route through i18n.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/tokens';

const I18N_OBJ = {
  t: (key) => key,
  i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
};
vi.mock('react-i18next', () => ({
  useTranslation: () => I18N_OBJ,
}));

import MCQSingle from '../components/question-types/MCQSingle';
import MCQMultiple from '../components/question-types/MCQMultiple';
import ShortAnswer from '../components/question-types/ShortAnswer';
import Ordering from '../components/question-types/Ordering';
import FillInTheBlank from '../components/question-types/FillInTheBlank';

const wrap = (ui) => render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('question-type explanation "Why?" label is i18n-routed (#45)', () => {
  const explanation = 'Because of grammar rule X.';

  it('MCQSingle uses test.whyLabel and not the English literal', () => {
    wrap(
      <MCQSingle
        question={{ options: [{ text: 'A', isCorrect: true }], explanation }}
        answer={0}
        onAnswer={() => {}}
        showFeedback={true}
        disabled={false}
      />
    );
    expect(screen.getByText('test.whyLabel')).toBeInTheDocument();
    expect(screen.queryByText(/^Why\?$/)).toBeNull();
  });

  it('MCQMultiple uses test.whyLabel and not the English literal', () => {
    wrap(
      <MCQMultiple
        question={{
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
          explanation,
        }}
        answer={[0]}
        onAnswer={() => {}}
        showFeedback={true}
        disabled={false}
      />
    );
    expect(screen.getByText('test.whyLabel')).toBeInTheDocument();
    expect(screen.queryByText(/^Why\?$/)).toBeNull();
  });

  it('ShortAnswer uses test.whyLabel and not the English literal', () => {
    wrap(
      <ShortAnswer
        question={{ acceptedAnswers: ['x'], explanation }}
        answer="x"
        onAnswer={() => {}}
        showFeedback={true}
        disabled={false}
      />
    );
    expect(screen.getByText('test.whyLabel')).toBeInTheDocument();
    expect(screen.queryByText(/^Why\?$/)).toBeNull();
  });

  it('Ordering uses test.whyLabel and not the English literal', () => {
    wrap(
      <Ordering
        question={{ items: ['one', 'two', 'three'], correctOrder: [0, 1, 2], explanation }}
        answer={[0, 1, 2]}
        onAnswer={() => {}}
        showFeedback={true}
        disabled={false}
      />
    );
    expect(screen.getByText('test.whyLabel')).toBeInTheDocument();
    expect(screen.queryByText(/^Why\?$/)).toBeNull();
  });

  it('FillInTheBlank uses test.whyLabel and not the English literal', () => {
    wrap(
      <FillInTheBlank
        question={{
          text: 'The sky is ___.',
          blanks: [{ acceptedAnswers: ['blue'] }],
          explanation,
        }}
        answer={['blue']}
        onAnswer={() => {}}
        showFeedback={true}
        disabled={false}
      />
    );
    expect(screen.getByText('test.whyLabel')).toBeInTheDocument();
    expect(screen.queryByText(/^Why\?$/)).toBeNull();
  });
});
