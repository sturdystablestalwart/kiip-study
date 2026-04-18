import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../../../theme/tokens';
import EmptyState from '../EmptyState';

const renderWithTheme = (ui) =>
  render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('EmptyState', () => {
  it('renders title and description', () => {
    renderWithTheme(
      <EmptyState title="No results" description="Try a different search" />
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try a different search')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    renderWithTheme(<EmptyState icon="📊" title="Empty" />);
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('renders children (action buttons)', () => {
    renderWithTheme(
      <EmptyState title="Empty">
        <button>Take action</button>
      </EmptyState>
    );
    expect(screen.getByRole('button', { name: 'Take action' })).toBeInTheDocument();
  });

  it('renders without icon when not provided', () => {
    const { container } = renderWithTheme(
      <EmptyState title="No icon" description="Just text" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(0);
  });
});
