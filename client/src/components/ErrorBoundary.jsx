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

const ButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.layout.space[3]}px;
`;

/**
 * Issue #173 — when wrapping the entire <Router>, any render error
 * nukes the whole SPA and the only escape was a full reload, which
 * loses in-progress test answers in other tabs and forces a re-login.
 *
 * The boundary now exposes a "Try again" path that just resets
 * hasError, plus a resetKey prop callers can use to auto-recover on
 * route change (typically the URL pathname).  Reload stays as the
 * nuclear option.
 */
// Issue #49 — detect chunk-load failures so a deploy that swapped
// hashed JS out from under an open session can offer a hard reload
// instead of a generic error.  React's ChunkLoadError extends Error
// with name 'ChunkLoadError'; Vite/rolldown emit it too.
function isChunkLoadError(err) {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const msg = String(err.message || '');
  return /Loading chunk \d+ failed/i.test(msg) ||
         /Failed to fetch dynamically imported module/i.test(msg) ||
         /Importing a module script failed/i.test(msg);
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);

    // Issue #185 — best-effort telemetry POST so production failures
    // surface in pino logs instead of vanishing into the browser
    // console.  fire-and-forget; we never want telemetry failures to
    // mask the original error.
    if (import.meta.env.PROD) {
      try {
        fetch('/api/_log/client-error', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            message: error?.message ?? String(error),
            stack: (error?.stack || '').slice(0, 4000),
            componentStack: (info?.componentStack || '').slice(0, 4000),
            url: typeof location !== 'undefined' ? location.href : '',
            ua: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 200),
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, isChunkError: false });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      // Issue #49 — chunk-load failure (most common after a deploy
      // swapped hashed JS) needs a hard reload to fetch the new
      // chunk; Retry-in-place can't recover.  Promote Reload to the
      // primary action.
      const chunk = this.state.isChunkError;
      return (
        <ErrorWrapper>
          <ErrorTitle>
            {chunk ? i18n.t('common.updateAvailable') : i18n.t('common.error')}
          </ErrorTitle>
          <ErrorMessage>
            {chunk ? i18n.t('common.errorDesc') : i18n.t('common.errorDesc')}
          </ErrorMessage>
          <ButtonRow>
            {chunk ? (
              <Button onClick={() => window.location.reload()}>
                {i18n.t('common.reload')}
              </Button>
            ) : (
              <>
                <Button onClick={this.handleReset}>
                  {i18n.t('common.retry')}
                </Button>
                <Button $variant="secondary" onClick={() => window.location.reload()}>
                  {i18n.t('common.reload')}
                </Button>
              </>
            )}
          </ButtonRow>
        </ErrorWrapper>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
