import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${({ theme }) => theme.colors.scrim};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Panel = styled.div`
  width: 90%;
  max-width: 400px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border-radius: ${({ theme }) => theme.layout.radius.lg}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  padding: ${({ theme }) => theme.layout.space[6]}px;
`;

const Title = styled.h2`
  margin: 0 0 ${({ theme }) => theme.layout.space[5]}px 0;
  font-size: ${({ theme }) => theme.typography.scale.h3.size}px;
  font-weight: ${({ theme }) => theme.typography.scale.h3.weight};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ShortcutRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.layout.space[2]}px 0;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border.subtle};
  }
`;

const ShortcutLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.scale.body.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const Kbd = styled.kbd`
  display: inline-block;
  padding: ${({ theme }) => theme.layout.space[1]}px ${({ theme }) => theme.layout.space[2]}px;
  background: ${({ theme }) => theme.colors.bg.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  font-family: inherit;
  color: ${({ theme }) => theme.colors.text.muted};
`;

const shortcuts = [
  { keys: 'Ctrl+P', labelKey: 'shortcuts.commandPalette' },
  { keys: 'Ctrl+K', labelKey: 'shortcuts.showPanel' },
  { keys: '1 – 4', labelKey: 'shortcuts.selectOption' },
  { keys: '\u2190 \u2192', labelKey: 'shortcuts.prevNext' },
  { keys: 'Enter', labelKey: 'shortcuts.confirm' },
  { keys: 'Esc', labelKey: 'shortcuts.close' },
];

function ShortcutsModal({ onClose }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <Overlay onClick={onClose}>
      <Panel ref={panelRef} onClick={e => e.stopPropagation()}>
        <Title>{t('shortcuts.title')}</Title>
        {shortcuts.map(({ keys, labelKey }) => (
          <ShortcutRow key={keys}>
            <ShortcutLabel>{t(labelKey)}</ShortcutLabel>
            <Kbd>{keys}</Kbd>
          </ShortcutRow>
        ))}
      </Panel>
    </Overlay>
  );
}

export default ShortcutsModal;
