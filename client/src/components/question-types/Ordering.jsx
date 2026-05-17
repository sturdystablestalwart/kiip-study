import React, { useState, useRef, useCallback } from 'react';
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

const ItemList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  min-height: ${({ theme }) => theme.layout.controlHeights.button}px;
  padding: ${({ theme }) => theme.layout.space[3]}px ${({ theme }) => theme.layout.space[4]}px;
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  line-height: ${({ theme }) => theme.typography.scale.body.line}px;
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  opacity: ${({ $isDragging }) => $isDragging ? 0.5 : 1};
  transform: ${({ $isOver }) => $isOver ? 'scale(1.02)' : 'scale(1)'};
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              transform ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  user-select: none;

  border-left: 4px solid ${({ $correctPos, $incorrectPos, $showFeedback, theme }) => {
    if ($showFeedback && $correctPos) return theme.colors.state.success;
    if ($showFeedback && $incorrectPos) return theme.colors.state.danger;
    return theme.colors.border.subtle;
  }};

  background: ${({ $correctPos, $incorrectPos, $showFeedback, $dragging, theme }) => {
    if ($showFeedback && $correctPos) return theme.colors.state.correctBg;
    if ($showFeedback && $incorrectPos) return theme.colors.state.wrongBg;
    if ($dragging) return theme.colors.selection.bg;
    return theme.colors.bg.surface;
  }};

  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'grab')};

  &:active {
    cursor: ${({ $disabled }) => ($disabled ? 'default' : 'grabbing')};
  }

  animation: ${({ $showFeedback, $isCorrectPosition }) => {
    if (!$showFeedback) return css`none`;
    if ($isCorrectPosition) return css`${correctPulse} 300ms ease-out`;
    if ($showFeedback && !$isCorrectPosition) return css`${incorrectShake} 300ms ease-out`;
    return css`none`;
  }};

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DragHandle = styled.span`
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  flex-shrink: 0;
  line-height: 1;
`;

const ItemText = styled.span`
  flex: 1;
`;

const ArrowButton = styled.button`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accent.indigo};
    background: ${({ theme }) => theme.colors.selection.bg};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
`;

const ArrowGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[1]}px;
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

function Ordering({ question, answer, onAnswer, showFeedback, disabled }) {
  const options = question.options ?? [];
  const correctOrder = question.correctOrder ?? options.map((_, i) => i);
  const orderedItems = answer?.orderedItems ?? options.map((_, i) => i);

  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [ariaMessage, setAriaMessage] = useState('');
  const dragItem = useRef(null);

  const swap = useCallback(
    (fromIdx, toIdx) => {
      if (disabled) return;
      if (toIdx < 0 || toIdx >= orderedItems.length) return;
      const next = [...orderedItems];
      const temp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = temp;
      onAnswer({ orderedItems: next });
      setAriaMessage(`Moved item to position ${toIdx + 1}`);
    },
    [disabled, orderedItems, onAnswer]
  );

  const handleDragStart = (e, idx) => {
    if (disabled) return;
    dragItem.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, position) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(position);
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragItem.current;
    if (fromIdx === null || fromIdx === dropIdx || disabled) {
      setDraggingIdx(null);
      dragItem.current = null;
      return;
    }
    // Move item from fromIdx to dropIdx
    const next = [...orderedItems];
    const moved = next.splice(fromIdx, 1)[0];
    next.splice(dropIdx, 0, moved);
    onAnswer({ orderedItems: next });
    setAriaMessage(`Moved item to position ${dropIdx + 1}`);
    setDraggingIdx(null);
    setDragOverIdx(null);
    dragItem.current = null;
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
    dragItem.current = null;
  };

  return (
    <div>
      <ItemList>
        {orderedItems.map((optionIdx, position) => {
          const isCorrectPosition =
            showFeedback && correctOrder[position] === optionIdx;
          const isIncorrectPosition =
            showFeedback && correctOrder[position] !== optionIdx;

          return (
            <Item
              key={optionIdx}
              $correctPos={isCorrectPosition}
              $incorrectPos={isIncorrectPosition}
              $showFeedback={showFeedback}
              $isCorrectPosition={isCorrectPosition}
              $dragging={draggingIdx === position}
              $isDragging={draggingIdx === position}
              $isOver={dragOverIdx === position}
              $disabled={disabled}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, position)}
              onDragOver={(e) => handleDragOver(e, position)}
              onDrop={(e) => handleDrop(e, position)}
              onDragEnd={handleDragEnd}
            >
              {!disabled && <DragHandle>&#9776;</DragHandle>}
              <ItemText>{options[optionIdx]?.text ?? `Item ${optionIdx + 1}`}</ItemText>
              {!disabled && (
                <ArrowGroup>
                  <ArrowButton
                    onClick={() => swap(position, position - 1)}
                    disabled={position === 0}
                    aria-label="Move up"
                  >
                    &#8593;
                  </ArrowButton>
                  <ArrowButton
                    onClick={() => swap(position, position + 1)}
                    disabled={position === orderedItems.length - 1}
                    aria-label="Move down"
                  >
                    &#8595;
                  </ArrowButton>
                </ArrowGroup>
              )}
            </Item>
          );
        })}
      </ItemList>

      {showFeedback && question.explanation && (
        <ExplanationPanel>
          <strong>Why?</strong> {question.explanation}
        </ExplanationPanel>
      )}

      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0,
        }}
      >
        {ariaMessage}
      </span>
    </div>
  );
}

export default Ordering;
