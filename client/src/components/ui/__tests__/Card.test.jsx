import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../../../theme/tokens';
import Card from '../Card';

const renderWithTheme = (ui) =>
  render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('Card', () => {
  it('renders children', () => {
    renderWithTheme(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('uses surface background by default', () => {
    renderWithTheme(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle(`background: ${lightTheme.colors.bg.surface}`);
  });

  it('uses surfaceAlt background with $alt prop', () => {
    renderWithTheme(<Card $alt data-testid="card">Alt</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle(`background: ${lightTheme.colors.bg.surfaceAlt}`);
  });

  it('applies border and shadow', () => {
    renderWithTheme(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle(`box-shadow: ${lightTheme.layout.shadow.sm}`);
  });

  it('applies lg padding', () => {
    renderWithTheme(<Card $padding="lg" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle(`padding: ${lightTheme.layout.space[7]}px`);
  });

  it('applies no padding with $padding="none"', () => {
    renderWithTheme(<Card $padding="none" data-testid="card">Content</Card>);
    const card = screen.getByTestId('card');
    expect(card).toHaveStyle('padding: 0px');
  });
});
