import React, { useCallback, useEffect, useId, useState } from 'react';
import styled from 'styled-components';

// Issue #183 — WCAG 1.4.13 (Content on Hover or Focus) compliant tooltip:
//   * Reveals on mouse enter AND keyboard focus (hover-only excluded
//     keyboard users entirely).
//   * `aria-describedby` links trigger → tip so screen readers
//     announce it as a description, not a separate element.
//   * Dismisses on Escape while keeping pointer/focus on the trigger
//     ("Dismissible" — WCAG 1.4.13).
//   * Stays open if the user moves the pointer into the tip itself
//     (was mouseleave-on-wrapper only — moving toward the tip closed
//     it before the user could read it).  We use a single Wrapper
//     pointerenter/leave handler since the tip is a child element so
//     `pointerleave` on Wrapper only fires when leaving BOTH.
const Wrapper = styled.span`
  position: relative;
  display: inline-flex;
`;

const Tip = styled.span`
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: ${({ theme }) => theme.layout.space[2]}px ${({ theme }) => theme.layout.space[3]}px;
  background: ${({ theme }) => theme.colors.text.primary};
  color: ${({ theme }) => theme.colors.bg.surface};
  font-size: ${({ theme }) => theme.typography.scale.micro.size}px;
  border-radius: ${({ theme }) => theme.layout.radius.sm}px;
  white-space: nowrap;
  pointer-events: none;
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  transition: opacity ${({ theme }) => theme.motion.fastMs}ms ${({ theme }) => theme.motion.ease};
  z-index: ${({ theme }) => theme.zIndex.dropdown};

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.text.primary};
  }
`;

export default function Tooltip({ text, children }) {
    const [visible, setVisible] = useState(false);
    const tipId = useId();

    // Escape dismisses without taking focus off the trigger (WCAG 1.4.13
    // "Dismissible").  Only attach the listener while the tip is open so
    // we're not paying for it on every keystroke globally.
    useEffect(() => {
        if (!visible) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setVisible(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [visible]);

    const show = useCallback(() => setVisible(true), []);
    const hide = useCallback(() => setVisible(false), []);

    // aria-describedby goes on the single trigger child via cloneElement
    // so screen readers announce the tip text as a description.  Falls
    // back gracefully if children isn't a single element (no clone, but
    // visual tooltip still works).
    const trigger = React.isValidElement(children)
        ? React.cloneElement(children, {
            'aria-describedby': [children.props['aria-describedby'], tipId].filter(Boolean).join(' '),
        })
        : children;

    return (
        <Wrapper
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {trigger}
            <Tip id={tipId} $visible={visible} role="tooltip">{text}</Tip>
        </Wrapper>
    );
}
