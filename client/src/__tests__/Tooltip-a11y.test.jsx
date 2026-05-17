// Issue #183 — pins WCAG 1.4.13 behavior for Tooltip:
//   * focus shows / blur hides (keyboard parity with mouse)
//   * Escape dismisses while keeping focus on the trigger
//   * trigger gets aria-describedby pointing at the tip
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import Tooltip from '../components/Tooltip';
import { lightTheme } from '../theme/tokens';

function renderWithTheme(ui) {
    return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

describe('Tooltip — WCAG 1.4.13 a11y', () => {
    test('trigger child gets aria-describedby pointing at the tip', () => {
        renderWithTheme(
            <Tooltip text="Submit the form">
                <button>Save</button>
            </Tooltip>
        );
        const btn = screen.getByRole('button', { name: 'Save' });
        const tipId = btn.getAttribute('aria-describedby');
        expect(tipId).toBeTruthy();
        const tip = document.getElementById(tipId);
        expect(tip).not.toBeNull();
        expect(tip).toHaveTextContent('Submit the form');
    });

    test('focus on trigger reveals the tip; blur hides it', () => {
        renderWithTheme(
            <Tooltip text="Save your work">
                <button>Save</button>
            </Tooltip>
        );
        const btn = screen.getByRole('button', { name: 'Save' });
        const tip = screen.getByRole('tooltip');

        // Pre-focus: hidden (opacity 0).
        expect(tip).toHaveStyle({ opacity: '0' });

        // fireEvent.focus dispatches React's synthetic focus event;
        // bare element.focus() in jsdom doesn't bubble to onFocus reliably.
        fireEvent.focus(btn);
        expect(tip).toHaveStyle({ opacity: '1' });

        fireEvent.blur(btn);
        expect(tip).toHaveStyle({ opacity: '0' });
    });

    test('Escape dismisses the tooltip without losing focus on the trigger', () => {
        renderWithTheme(
            <Tooltip text="Save your work">
                <button>Save</button>
            </Tooltip>
        );
        const btn = screen.getByRole('button', { name: 'Save' });
        const tip = screen.getByRole('tooltip');

        btn.focus();
        fireEvent.focus(btn);
        expect(tip).toHaveStyle({ opacity: '1' });

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(tip).toHaveStyle({ opacity: '0' });
        // Focus stays on the trigger — WCAG 1.4.13 "Dismissible".
        expect(document.activeElement).toBe(btn);
    });

    test('mouseenter / mouseleave still works (existing behavior preserved)', () => {
        const { container } = renderWithTheme(
            <Tooltip text="Submit">
                <button>Save</button>
            </Tooltip>
        );
        const wrapper = container.firstChild;
        const tip = screen.getByRole('tooltip');

        fireEvent.mouseEnter(wrapper);
        expect(tip).toHaveStyle({ opacity: '1' });

        fireEvent.mouseLeave(wrapper);
        expect(tip).toHaveStyle({ opacity: '0' });
    });

    test('preserves caller-supplied aria-describedby on the trigger', () => {
        renderWithTheme(
            <Tooltip text="Submit">
                <button aria-describedby="caller-help">Save</button>
            </Tooltip>
        );
        const btn = screen.getByRole('button', { name: 'Save' });
        const combined = btn.getAttribute('aria-describedby').split(' ');
        // Caller id preserved AND the tip id is appended.
        expect(combined).toContain('caller-help');
        expect(combined.length).toBeGreaterThan(1);
    });
});
