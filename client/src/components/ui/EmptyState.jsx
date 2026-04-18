import styled from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: ${p => p.theme.colors.bg.surface};
  border: 1px solid ${p => p.theme.colors.border.subtle};
  border-radius: ${p => p.theme.layout.radius.lg}px;
  padding: ${p => p.theme.layout.space[9]}px ${p => p.theme.layout.space[5]}px;
`;

const Icon = styled.span`
  font-size: 40px;
  margin-bottom: ${p => p.theme.layout.space[4]}px;
  line-height: 1;
`;

const Title = styled.h3`
  margin-bottom: ${p => p.theme.layout.space[2]}px;
`;

const Description = styled.p`
  color: ${p => p.theme.colors.text.muted};
  font-size: ${p => p.theme.typography.scale.body.size}px;
  margin-bottom: ${p => p.theme.layout.space[5]}px;
  max-width: 40ch;
`;

export default function EmptyState({ icon, title, description, children }) {
  return (
    <Wrapper>
      {icon && <Icon>{icon}</Icon>}
      {title && <Title>{title}</Title>}
      {description && <Description>{description}</Description>}
      {children}
    </Wrapper>
  );
}
