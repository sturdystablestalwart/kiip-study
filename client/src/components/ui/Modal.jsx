import { useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import useFocusTrap from '../../hooks/useFocusTrap';

/* ---- styled parts ---- */

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: ${p => p.theme.colors.scrim};
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: ${p => p.$zIndex || p.theme.zIndex.modal};
  display: flex;
  align-items: ${p => (p.$position === 'top' ? 'flex-start' : 'center')};
  justify-content: center;
  padding: ${p => (p.$position === 'top' ? '15vh 16px 16px' : '16px')};
`;

const Container = styled.div`
  width: 90%;
  max-width: ${p => p.$maxWidth || 420}px;
  max-height: ${p => p.$maxHeight || 'calc(100vh - 64px)'};
  background: ${p => p.theme.colors.bg.surface};
  border-radius: ${p => p.theme.layout.radius.lg}px;
  box-shadow: ${p => p.theme.layout.shadow.md};
  padding: ${p => p.$flush ? 0 : p.theme.layout.space[7]}px;
  overflow: ${p => p.$flush ? 'hidden' : 'auto'};
`;

/* ---- Modal Actions row (export for consumers) ---- */

export const ModalActions = styled.div`
  display: flex;
  gap: ${p => p.theme.layout.space[3]}px;
  margin-top: ${p => p.theme.layout.space[5]}px;
  justify-content: flex-end;
`;

/* ---- component ---- */

export default function Modal({
  children,
  onClose,
  maxWidth,
  maxHeight,
  position,
  zIndex,
  flush,
  ariaLabel,
  ariaLabelledBy,
}) {
  const containerRef = useRef(null);
  useFocusTrap(containerRef);

  const handleEscape = useCallback(e => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Issue #42 — dev-only warning when neither aria-label nor
  // aria-labelledby is supplied.  Screen readers otherwise announce a
  // nameless dialog and the user loses the title context.
  useEffect(() => {
    if (import.meta.env.DEV && !ariaLabel && !ariaLabelledBy) {
      console.warn('[Modal] Either `ariaLabel` or `ariaLabelledBy` must be set so screen readers can announce the dialog title.');
    }
  }, [ariaLabel, ariaLabelledBy]);

  const handleOverlayClick = useCallback(() => onClose(), [onClose]);
  const stopProp = useCallback(e => e.stopPropagation(), []);

  return (
    <Overlay
      onClick={handleOverlayClick}
      $position={position}
      $zIndex={zIndex}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <Container
        ref={containerRef}
        onClick={stopProp}
        $maxWidth={maxWidth}
        $maxHeight={maxHeight}
        $flush={flush}
      >
        {children}
      </Container>
    </Overlay>
  );
}
