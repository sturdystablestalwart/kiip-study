import styled, { keyframes } from 'styled-components';
import i18n from '../i18n';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 30vh;
  gap: ${({ theme }) => theme.layout.space[4]}px;
`;

const Spinner = styled.div`
  width: 28px;
  height: 28px;
  border: 2px solid ${({ theme }) => theme.colors.border.subtle};
  border-top-color: ${({ theme }) => theme.colors.accent.clay};
  border-radius: 50%;
  animation: ${spin} 600ms linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Label = styled.p`
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.faint};
  margin: 0;
  max-width: none;
`;

export default function LoadingFallback() {
  return (
    <Wrapper>
      <Spinner />
      <Label>{i18n.t('common.loading')}</Label>
    </Wrapper>
  );
}
