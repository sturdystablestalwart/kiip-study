import React from 'react';
import styled from 'styled-components';
import i18n from '../i18n';
import { Button } from './ui';

const ErrorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  padding: ${({ theme }) => theme.layout.space[9]}px ${({ theme }) => theme.layout.space[5]}px;
  text-align: center;
`;

const ErrorTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  margin-bottom: ${({ theme }) => theme.layout.space[3]}px;
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.text.faint};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  margin-bottom: ${({ theme }) => theme.layout.space[5]}px;
  max-width: 400px;
`;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorWrapper>
          <ErrorTitle>{i18n.t('common.error')}</ErrorTitle>
          <ErrorMessage>
            {i18n.t('common.errorDesc')}
          </ErrorMessage>
          <Button onClick={() => window.location.reload()}>
            {i18n.t('common.reload')}
          </Button>
        </ErrorWrapper>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
