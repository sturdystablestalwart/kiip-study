/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';

const slideIn = keyframes`
  from { transform: translateX(-50%) translateY(100%); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateX(-50%) translateY(0);    opacity: 1; }
  to   { transform: translateX(-50%) translateY(100%); opacity: 0; }
`;

const ToastContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.layout.space[6]}px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  pointer-events: none;
  align-items: center;
`;

const ToastItem = styled.div`
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.layout.space[3]}px;
  padding: ${({ theme }) => theme.layout.space[4]}px ${({ theme }) => theme.layout.space[5]}px;
  background: ${({ theme }) => theme.colors.bg.surface};
  border: 1px solid ${({ theme }) => theme.colors.border.subtle};
  border-radius: ${({ theme }) => theme.layout.radius.md}px;
  box-shadow: ${({ theme }) => theme.layout.shadow.md};
  font-size: ${({ theme }) => theme.typography.scale.small.size}px;
  color: ${({ theme }) => theme.colors.text.primary};
  animation: ${({ $exiting }) => $exiting ? slideOut : slideIn}
             ${({ theme }) => theme.motion.baseMs}ms ${({ theme }) => theme.motion.ease} forwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DismissButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.faint};
  cursor: pointer;
  padding: 2px;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  font-family: inherit;
  transition: color ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};

  &:hover { color: ${({ theme }) => theme.colors.text.primary}; }
`;

let toastIdCounter = 0;

export function showToast(message, type = 'info', duration = 5000) {
  window.dispatchEvent(new CustomEvent('toast:show', {
    detail: { id: ++toastIdCounter, message, type, duration }
  }));
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { id, message, duration } = e.detail;
      setToasts(prev => [...prev, { id, message, exiting: false }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, 160);
        }, duration);
      }
    };

    window.addEventListener('toast:show', handler);
    return () => window.removeEventListener('toast:show', handler);
  }, []);

  const dismiss = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 160);
  };

  if (!toasts.length) return null;

  return (
    <ToastContainer>
      {toasts.map(toast => (
        <ToastItem key={toast.id} $exiting={toast.exiting}>
          {toast.message}
          <DismissButton onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            &times;
          </DismissButton>
        </ToastItem>
      ))}
    </ToastContainer>
  );
}
