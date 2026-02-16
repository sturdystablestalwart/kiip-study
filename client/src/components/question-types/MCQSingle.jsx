import React from 'react';
import styled from 'styled-components';

/* ───────── Styled Components ───────── */

const OptionsGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

const OptionButton = styled.button`
  min-height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  text-align: left;
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  background: ${({ $isCorrect, $selected, $showFeedback, theme }) => {
    if ($isCorrect && $showFeedback) return theme.colors.state.correctBg;
    if ($selected && $showFeedback && !$isCorrect) return theme.colors.state.wrongBg;
    if ($selected) return theme.colors.selection.bg;
    return theme.colors.bg.surface;
  }};

  border: 1px solid ${({ $isCorrect, $selected, $showFeedback, theme }) => {
    if ($isCorrect && $showFeedback) return theme.colors.state.success;
    if ($selected && $showFeedback && !$isCorrect) return theme.colors.state.danger;
    if ($selected) return theme.colors.accent.indigo;
    return theme.colors.border.subtle;
  }};

  color: ${({ theme }) => theme.colors.text.primary};

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ $selected, $showFeedback, theme }) => {
      if ($showFeedback) return undefined;
      if ($selected) return theme.colors.selection.bg;
      return theme.colors.bg.surfaceAlt;
    }};
  }

  &:disabled {
    cursor: default;
  }
`;

const ExplanationPanel = styled.div`
  margin-top: ${({ theme }) => theme.layout.space[6]}px;
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

/* ───────── Component ───────── */

function MCQSingle({ question, answer, onAnswer, showFeedback, disabled }) {
  const selectedIndex = answer?.selectedOptions?.[0] ?? null;

  const handleClick = (idx) => {
    if (disabled) return;
    onAnswer({ selectedOptions: [idx] });
  };

  return (
    <div>
      <OptionsGrid>
        {question.options.map((opt, idx) => (
          <OptionButton
            key={idx}
            $selected={selectedIndex === idx}
            $isCorrect={opt.isCorrect}
            $showFeedback={showFeedback}
            onClick={() => handleClick(idx)}
            disabled={disabled}
          >
            {idx + 1}. {opt.text}
          </OptionButton>
        ))}
      </OptionsGrid>

      {showFeedback && question.explanation && (
        <ExplanationPanel>
          <strong>Why?</strong> {question.explanation}
        </ExplanationPanel>
      )}
    </div>
  );
}

export default MCQSingle;
