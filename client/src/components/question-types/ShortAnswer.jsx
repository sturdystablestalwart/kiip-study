import React from 'react';
import styled from 'styled-components';

/* ───────── Styled Components ───────── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const AnswerInput = styled.input`
  height: ${({ theme }) => theme.layout.controlHeights.input}px;
  padding: 0 ${({ theme }) => theme.layout.space[4]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  border: 1px solid ${({ $correct, $incorrect, theme }) => {
    if ($correct) return theme.colors.state.success;
    if ($incorrect) return theme.colors.state.danger;
    return theme.colors.border.subtle;
  }};

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.faint};
  }

  &:focus {
    outline: none;
    border-color: ${({ $correct, $incorrect, theme }) => {
      if ($correct) return theme.colors.state.success;
      if ($incorrect) return theme.colors.state.danger;
      return theme.colors.accent.indigo;
    }};
  }

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
`;

const FeedbackMessage = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.body.weight};
  color: ${({ $correct, theme }) =>
    $correct ? theme.colors.state.success : theme.colors.state.danger};
`;

const AcceptedList = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.layout.space[5]}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.muted};

  li {
    margin-bottom: ${({ theme }) => theme.layout.space[1]}px;
  }
`;

const ExplanationPanel = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[4]}px;
  padding: ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.state.infoBg};
  border-left: 4px solid ${({ theme }) => theme.colors.accent.indigo};
  border-radius: 0 ${({ theme }) => theme.layout.radius.sm}px ${({ theme }) => theme.layout.radius.sm}px 0;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  color: ${({ theme }) => theme.colors.text.primary};

  strong {
    color: ${({ theme }) => theme.colors.accent.indigo};
  }
`;

/* ───────── Helpers ───────── */

function checkCorrectness(userAnswer, acceptedAnswers) {
  if (!userAnswer || !acceptedAnswers || acceptedAnswers.length === 0) return false;
  const normalised = userAnswer.trim().toLowerCase();
  return acceptedAnswers.some(
    (a) => a.trim().toLowerCase() === normalised
  );
}

/* ───────── Component ───────── */

function ShortAnswer({ question, answer, onAnswer, showFeedback, disabled }) {
  const textAnswer = answer?.textAnswer ?? '';
  const accepted = question.acceptedAnswers ?? [];
  const isCorrect = showFeedback ? checkCorrectness(textAnswer, accepted) : null;

  const handleChange = (e) => {
    if (disabled) return;
    onAnswer({ textAnswer: e.target.value });
  };

  return (
    <Wrapper>
      <AnswerInput
        type="text"
        value={textAnswer}
        onChange={handleChange}
        placeholder="Type your answer..."
        disabled={disabled}
        $correct={showFeedback && isCorrect}
        $incorrect={showFeedback && !isCorrect && textAnswer.length > 0}
      />

      {showFeedback && isCorrect && (
        <FeedbackMessage $correct>Correct!</FeedbackMessage>
      )}

      {showFeedback && !isCorrect && textAnswer.length > 0 && accepted.length > 0 && (
        <>
          <FeedbackMessage>Incorrect. Accepted answers:</FeedbackMessage>
          <AcceptedList>
            {accepted.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </AcceptedList>
        </>
      )}

      {showFeedback && question.explanation && (
        <ExplanationPanel>
          <strong>Why?</strong> {question.explanation}
        </ExplanationPanel>
      )}
    </Wrapper>
  );
}

export default ShortAnswer;
