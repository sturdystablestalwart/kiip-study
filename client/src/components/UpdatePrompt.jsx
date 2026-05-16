/**
 * UpdatePrompt — "A new version is available" banner.
 *
 * Pairs with `VitePWA({ registerType: 'autoUpdate' })` in `vite.config.js`.
 * Without this component the new service worker installs but stays in the
 * `waiting` state until every tab closes, so users on long-running sessions
 * (TestTaker, EndlessMode) run stale code for hours after a deploy.
 *
 * Implementation notes:
 *  - Uses the official `virtual:pwa-register/react` virtual module exposed
 *    by vite-plugin-pwa. Vitest mocks this module in
 *    `src/__tests__/UpdatePrompt.test.jsx`.
 *  - Clicking "Reload" calls `updateServiceWorker(true)` which sends
 *    `skipWaiting` to the new SW and reloads the page once it activates.
 *  - Clicking "Close" only clears the local `needRefresh` flag — the SW
 *    will reload on the next natural navigation / app restart.
 *
 * See issue #122.
 */

import React from 'react';
import styled from 'styled-components';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';

const Banner = styled.div`
  position: fixed;
  left: 50%;
  bottom: ${({ theme }) => theme.layout.space[5]}px;
  transform: translateX(-50%);
  z-index: ${({ theme }) => theme.zIndex.toast};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[4]}px;
  padding: ${({ theme }) => theme.layout.space[3]}px
           ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  max-width: calc(100vw - ${({ theme }) => theme.layout.space[6]}px);
`;

const Message = styled.span`
  color: ${({ theme }) => theme.colors.text.primary};
`;

const Actions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[2]}px;
`;

/**
 * Optional override hook — accepts an alternative `useRegisterSW` impl to
 * keep stories / non-PWA preview builds testable. Defaults to the real
 * vite-plugin-pwa virtual module.
 */
export default function UpdatePrompt({ useRegisterSWImpl = useRegisterSW } = {}) {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSWImpl();

  // Happy path: nothing to show.
  if (!needRefresh && !offlineReady) return null;

  const handleReload = () => {
    updateServiceWorker(true);
  };

  const handleClose = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const message = needRefresh
    ? t('common.updateAvailable', 'A new version is available')
    : t('common.offlineReady', 'App ready to work offline');

  return (
    <Banner role="status" aria-live="polite">
      <Message>{message}</Message>
      <Actions>
        {needRefresh && (
          <Button
            type="button"
            $variant="accent"
            $size="compact"
            onClick={handleReload}
          >
            {t('common.reloadNow', 'Reload')}
          </Button>
        )}
        <Button
          type="button"
          $variant="ghost"
          $size="compact"
          onClick={handleClose}
          aria-label={t('common.close', 'Close')}
        >
          {t('common.close', 'Close')}
        </Button>
      </Actions>
    </Banner>
  );
}
