import styled from 'styled-components';

const colorMap = {
  default: p => ({ bg: p.theme.colors.bg.surfaceAlt, text: p.theme.colors.text.muted }),
  indigo: p => ({ bg: `${p.theme.colors.accent.indigo}26`, text: p.theme.colors.accent.indigo }),
  clay: p => ({ bg: `${p.theme.colors.accent.clay}26`, text: p.theme.colors.accent.clay }),
  moss: p => ({ bg: `${p.theme.colors.accent.moss}26`, text: p.theme.colors.accent.moss }),
  success: p => ({ bg: p.theme.colors.state.correctBg, text: p.theme.colors.state.success }),
  warning: p => ({ bg: `${p.theme.colors.state.warning}33`, text: p.theme.colors.state.warning }),
  danger: p => ({ bg: p.theme.colors.state.wrongBg, text: p.theme.colors.state.danger }),
};

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.layout.space[1]}px;
  padding: 2px ${p => p.theme.layout.space[2]}px;
  border-radius: ${p => p.theme.layout.radius.pill}px;
  font-size: ${p => (p.$size === 'sm'
    ? p.theme.typography.scale.micro.size
    : p.theme.typography.scale.small.size)}px;
  font-weight: ${p => p.$bold ? 600 : p.theme.typography.scale.small.weight};
  line-height: 1.4;
  white-space: nowrap;
  flex-shrink: 0;
  background: ${p => (colorMap[p.$color] || colorMap.default)(p).bg};
  color: ${p => (colorMap[p.$color] || colorMap.default)(p).text};
`;

export default Badge;
