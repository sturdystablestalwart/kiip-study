import React from 'react';
import styled, { keyframes, css } from 'styled-components';

/* ───────── Animations ───────── */

const correctPulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const incorrectShake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
`;

/* ───────── Styled Components ───────── */

const HintText = styled.p`
  margin: 0 0 ${({ theme }) => theme.layout.space[4]}px 0;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
`;

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
  display: flex;
  align-items: center;

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

  animation: ${({ $showFeedback, $isCorrect, $selected }) => {
    if (!$showFeedback) return css`none`;
    if ($isCorrect) return css`${correctPulse} 300ms ease-out`;
    if ($selected && !$isCorrect) return css`${incorrectShake} 300ms ease-out`;
    return css`none`;
  }};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CheckIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid ${({ $checked, theme }) =>
    $checked ? theme.colors.accent.indigo : theme.colors.border.subtle};
  background: ${({ $checked, theme }) =>
    $checked ? theme.colors.accent.indigo : 'transparent'};
  margin-right: ${({ theme }) => theme.layout.space[3]}px;
  flex-shrink: 0;
  transition: all ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &::after {
    content: '';
    display: ${({ $checked }) => $checked ? 'block' : 'none'};
    width: 5px;
    height: 10px;
    border: solid ${({ theme }) => theme.colors.bg.surface};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-bottom: 2px;
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

function MCQMultiple({ question, answer, onAnswer, showFeedback, disabled }) {
  const selected = answer?.selectedOptions ?? [];

  const handleClick = (idx) => {
    if (disabled) return;
    const next = selected.includes(idx)
      ? selected.filter((i) => i !== idx)
      : [...selected, idx];
    onAnswer({ selectedOptions: next });
  };

  return (
    <div>
      <HintText>Select all that apply</HintText>
      <OptionsGrid role="group" aria-label="Answer options — select all that apply">
        {question.options.map((opt, idx) => {
          const isSelected = selected.includes(idx);
          return (
            <OptionButton
              key={idx}
              role="checkbox"
              aria-checked={isSelected}
              $selected={isSelected}
              $isCorrect={opt.isCorrect}
              $showFeedback={showFeedback}
              onClick={() => handleClick(idx)}
              disabled={disabled}
            >
              <CheckIcon $checked={isSelected} />
              {opt.text}
            </OptionButton>
          );
        })}
      </OptionsGrid>

      {showFeedback && question.explanation && (
        <ExplanationPanel>
          <strong>Why?</strong> {question.explanation}
        </ExplanationPanel>
      )}
    </div>
  );
}

export default MCQMultiple;
