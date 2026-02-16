import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';

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
  transition: border-color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease},
              background ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
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
  width: 32px;
  height: 32px;
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
    },
    [disabled, orderedItems, onAnswer]
  );

  const handleDragStart = (e, idx) => {
    if (disabled) return;
    dragItem.current = idx;
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    setDraggingIdx(null);
    dragItem.current = null;
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
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
              $dragging={draggingIdx === position}
              $disabled={disabled}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, position)}
              onDragOver={handleDragOver}
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
    </div>
  );
}

export default Ordering;
