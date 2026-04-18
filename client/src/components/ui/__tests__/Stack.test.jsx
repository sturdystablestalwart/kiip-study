import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../../../theme/tokens';
import Stack from '../Stack';

const renderWithTheme = (ui) =>
  render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('Stack', () => {
  it('renders children', () => {
    renderWithTheme(
      <Stack data-testid="stack">
        <div>Item 1</div>
        <div>Item 2</div>
      </Stack>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('defaults to vertical (column) direction', () => {
    renderWithTheme(<Stack data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveStyle('flex-direction: column');
  });

  it('renders horizontal with $horizontal prop', () => {
    renderWithTheme(<Stack $horizontal data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveStyle('flex-direction: row');
  });

  it('applies custom gap from theme space scale', () => {
    renderWithTheme(<Stack $gap={6} data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveStyle(`gap: ${lightTheme.layout.space[6]}px`);
  });

  it('applies custom alignment', () => {
    renderWithTheme(<Stack $align="center" data-testid="stack">Content</Stack>);
    expect(screen.getByTestId('stack')).toHaveStyle('align-items: center');
  });
});
