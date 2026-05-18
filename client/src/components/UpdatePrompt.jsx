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

import React, { useState } from 'react';
import styled from 'styled-components';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import Button from './ui/Button';

// Issue #500 — persist a "dismissed-until" timestamp so closing the
// prompt suppresses re-shows for SUPPRESS_HOURS instead of immediately
// re-firing on the next SW poll / navigation.
const DISMISS_KEY = 'kiip-sw-update-dismissed-until';
const SUPPRESS_HOURS = 4;

function isDismissed() {
    if (typeof localStorage === 'undefined') return false;
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return false;
        const until = Number(raw);
        if (!Number.isFinite(until)) return false;
        return Date.now() < until;
    } catch {
        return false;
    }
}

function markDismissed() {
    if (typeof localStorage === 'undefined') return;
    try {
        const until = Date.now() + SUPPRESS_HOURS * 3600 * 1000;
        localStorage.setItem(DISMISS_KEY, String(until));
    } catch { /* quota / blocked storage — no-op */ }
}

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

  // Issue #500 — read the persisted dismiss-until ONCE on mount.
  // Re-checking on every render would risk the prompt re-showing
  // mid-render after some other tab cleared the key.
  const [suppressed, setSuppressed] = useState(() => isDismissed());

  // Happy path: nothing to show (or dismissed inside the window).
  if ((!needRefresh && !offlineReady) || suppressed) return null;

  const handleReload = () => {
    updateServiceWorker(true);
  };

  const handleClose = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
    // Issue #500 — only suppress re-shows for the genuine update path.
    // offlineReady-only banner is informational; not re-shown anyway.
    if (needRefresh) {
        markDismissed();
        setSuppressed(true);
    }
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
