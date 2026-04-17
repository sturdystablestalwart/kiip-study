import React, { useState } from 'react';
import styled from 'styled-components';

const Wrapper = styled.span`
  position: relative;
  display: inline-flex;
`;

const Tip = styled.span`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.text.primary};
  color: ${({ theme }) => theme.colors.bg.surface};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  white-space: nowrap;
  pointer-events: none;
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  z-index: ${({ theme }) => theme.zIndex.dropdown};

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.text.primary};
  }
`;

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <Wrapper onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      <Tip $visible={visible} role="tooltip">{text}</Tip>
    </Wrapper>
  );
}
