import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../../../theme/tokens';
import Badge from '../Badge';

const renderWithTheme = (ui) =>
  render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('Badge', () => {
  it('renders children text', () => {
    renderWithTheme(<Badge>Level 3</Badge>);
    expect(screen.getByText('Level 3')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    renderWithTheme(<Badge data-testid="badge">Tag</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge.tagName).toBe('SPAN');
  });

  it('has inline-flex display', () => {
    renderWithTheme(<Badge data-testid="badge">Pill</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveStyle('display: inline-flex');
  });

  it('applies success color', () => {
    renderWithTheme(<Badge $color="success" data-testid="badge">Pass</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveStyle(`color: ${lightTheme.colors.state.success}`);
  });

  it('applies danger color', () => {
    renderWithTheme(<Badge $color="danger" data-testid="badge">Fail</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveStyle(`color: ${lightTheme.colors.state.danger}`);
  });

  it('applies bold weight', () => {
    renderWithTheme(<Badge $bold data-testid="badge">Bold</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveStyle('font-weight: 600');
  });
});
