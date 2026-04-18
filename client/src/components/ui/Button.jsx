import styled, { css } from 'styled-components';

const variantStyles = {
  primary: css`
    background: ${p => p.theme.colors.accent.clay};
    color: ${p => p.theme.colors.onAccent};
    border: none;
    &:hover:not(:disabled) {
      background: ${p => p.theme.colors.accent.clayHover};
    }
  `,
  secondary: css`
    background: transparent;
    color: ${p => p.theme.colors.text.muted};
    border: 1px solid ${p => p.theme.colors.border.subtle};
    &:hover:not(:disabled) {
      background: ${p => p.theme.colors.interactive.hoverBg};
      color: ${p => p.theme.colors.text.primary};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${p => p.theme.colors.text.muted};
    border: none;
    &:hover:not(:disabled) {
      background: ${p => p.theme.colors.interactive.hoverBg};
      color: ${p => p.theme.colors.text.primary};
    }
  `,
  danger: css`
    background: ${p => p.theme.colors.state.danger};
    color: ${p => p.theme.colors.onAccent};
    border: none;
    &:hover:not(:disabled) {
      opacity: 0.88;
    }
  `,
  accent: css`
    background: ${p => p.theme.colors.accent.indigo};
    color: ${p => p.theme.colors.onAccent};
    border: none;
    &:hover:not(:disabled) {
      opacity: 0.88;
    }
  `,
};

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.layout.space[2]}px;
  height: ${p => (p.$size === 'compact' ? p.theme.layout.controlHeights.compact : p.theme.layout.controlHeights.button)}px;
  padding: 0 ${p => (p.$size === 'compact' ? p.theme.layout.space[4] : p.theme.layout.space[5])}px;
  border-radius: ${p => p.theme.layout.radius.sm}px;
  font-family: inherit;
  font-size: ${p => (p.$size === 'compact' ? p.theme.typography.scale.small.size : p.theme.typography.scale.body.size)}px;
  font-weight: 550;
  cursor: pointer;
  transition:
    background ${p => p.theme.motion.baseMs}ms ${p => p.theme.motion.ease},
    color ${p => p.theme.motion.baseMs}ms ${p => p.theme.motion.ease},
    opacity ${p => p.theme.motion.baseMs}ms ${p => p.theme.motion.ease},
    box-shadow ${p => p.theme.motion.baseMs}ms ${p => p.theme.motion.ease};
  white-space: nowrap;

  &:disabled {
    background: ${p => p.theme.colors.interactive.disabledBg};
    color: ${p => p.theme.colors.interactive.disabledText};
    border-color: transparent;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.colors.focus.ring};
    outline-offset: 2px;
  }

  ${p => variantStyles[p.$variant || 'primary']}
`;

Button.defaultProps = {
  $variant: 'primary',
  $size: 'default',
};

export default Button;
