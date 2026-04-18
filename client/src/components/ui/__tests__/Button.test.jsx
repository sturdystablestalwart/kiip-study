import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme, darkTheme } from '../../../theme/tokens';
import Button from '../Button';

const renderWithTheme = (ui, theme = lightTheme) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('Button', () => {
  it('renders children', () => {
    renderWithTheme(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('renders with primary variant by default (clay background)', () => {
    renderWithTheme(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle(`background: ${lightTheme.colors.accent.clay}`);
  });

  it('renders secondary variant with border', () => {
    renderWithTheme(<Button $variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle('background: transparent');
  });

  it('renders danger variant', () => {
    renderWithTheme(<Button $variant="danger">Delete</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle(`background: ${lightTheme.colors.state.danger}`);
  });

  it('renders accent variant (indigo)', () => {
    renderWithTheme(<Button $variant="accent">Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle(`background: ${lightTheme.colors.accent.indigo}`);
  });

  it('renders compact size with smaller height', () => {
    renderWithTheme(<Button $size="compact">Small</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle(`height: ${lightTheme.layout.controlHeights.compact}px`);
  });

  it('applies disabled styles when disabled', () => {
    renderWithTheme(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveStyle('cursor: not-allowed');
  });

  it('works in dark theme', () => {
    renderWithTheme(<Button>Dark</Button>, darkTheme);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle(`background: ${darkTheme.colors.accent.clay}`);
  });

  it('renders as a different element with as prop', () => {
    renderWithTheme(<Button as="a" href="/test">Link</Button>);
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
  });
});
