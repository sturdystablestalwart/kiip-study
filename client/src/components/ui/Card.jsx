import styled, { css } from 'styled-components';

const paddingMap = {
  sm: p => p.theme.layout.space[4],
  md: p => p.theme.layout.space[5],
  lg: p => p.theme.layout.space[7],
  none: () => 0,
};

const Card = styled.div`
  background: ${p => p.$alt ? p.theme.colors.bg.surfaceAlt : p.theme.colors.bg.surface};
  border: 1px solid ${p => p.theme.colors.border.subtle};
  border-radius: ${p => p.theme.layout.radius[p.$radius || 'md']}px;
  padding: ${p => (paddingMap[p.$padding || 'md'] || paddingMap.md)(p)}px;
  box-shadow: ${p => p.theme.layout.shadow[p.$shadow || 'sm']};

  ${p => p.$interactive && css`
    cursor: pointer;
    transition:
      box-shadow ${p.theme.motion.baseMs}ms ${p.theme.motion.ease},
      transform ${p.theme.motion.baseMs}ms ${p.theme.motion.ease};
    &:hover {
      box-shadow: ${p.theme.layout.shadow.md};
      transform: translateY(-2px);
    }
  `}
`;

export default Card;
