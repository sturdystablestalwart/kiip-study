import React from 'react';
import styled from 'styled-components';

/* ───────── Styled Components ───────── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const SentenceWrapper = styled.div`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: 2.2;
  color: ${({ theme }) => theme.colors.text.primary};
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${({ theme }) => theme.layout.space[1]}px;
`;

const TextSegment = styled.span`
  white-space: pre-wrap;
`;

const BlankInput = styled.input`
  display: inline-block;
  width: 120px;
  height: 36px;
  padding: 0 ${({ theme }) => theme.layout.space[3]}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.primary};
  background: ${({ theme }) => theme.colors.bg.surface};
  vertical-align: baseline;
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

const BlankFeedback = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  color: ${({ theme }) => theme.colors.state.danger};
  margin-left: ${({ theme }) => theme.layout.space[1]}px;
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

function checkBlank(userVal, blankDef) {
  if (!userVal || !blankDef) return false;
  const accepted = blankDef.acceptedAnswers ?? [blankDef.answer ?? ''];
  const normalised = userVal.trim().toLowerCase();
  return accepted.some((a) => a.trim().toLowerCase() === normalised);
}

/* ───────── Component ───────── */

function FillInTheBlank({ question, answer, onAnswer, showFeedback, disabled }) {
  const blanks = question.blanks ?? [];
  const blankAnswers = answer?.blankAnswers ?? blanks.map(() => '');

  // Split the question text on ___ (3 underscores)
  const segments = question.text.split('___');

  const handleChange = (blankIdx, value) => {
    if (disabled) return;
    const next = [...blankAnswers];
    next[blankIdx] = value;
    onAnswer({ blankAnswers: next });
  };

  let blankCounter = 0;

  return (
    <Wrapper>
      <SentenceWrapper>
        {segments.map((segment, segIdx) => {
          const isLast = segIdx === segments.length - 1;
          const currentBlankIdx = blankCounter;

          if (!isLast) {
            blankCounter++;
          }

          const blankDef = blanks[currentBlankIdx];
          const userVal = blankAnswers[currentBlankIdx] ?? '';
          const isCorrect = showFeedback && blankDef ? checkBlank(userVal, blankDef) : false;
          const isIncorrect = showFeedback && blankDef && userVal.length > 0 && !isCorrect;

          return (
            <React.Fragment key={segIdx}>
              <TextSegment>{segment}</TextSegment>
              {!isLast && (
                <>
                  <BlankInput
                    type="text"
                    value={userVal}
                    onChange={(e) => handleChange(currentBlankIdx, e.target.value)}
                    disabled={disabled}
                    $correct={isCorrect}
                    $incorrect={isIncorrect}
                    placeholder={`blank ${currentBlankIdx + 1}`}
                    aria-label={`Blank ${currentBlankIdx + 1}`}
                  />
                  {showFeedback && isIncorrect && blankDef && (
                    <BlankFeedback>
                      {(blankDef.acceptedAnswers ?? [blankDef.answer]).join(' / ')}
                    </BlankFeedback>
                  )}
                </>
              )}
            </React.Fragment>
          );
        })}
      </SentenceWrapper>

      {showFeedback && question.explanation && (
        <ExplanationPanel>
          <strong>Why?</strong> {question.explanation}
        </ExplanationPanel>
      )}
    </Wrapper>
  );
}

export default FillInTheBlank;
