import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../../../theme/tokens';
import Modal, { ModalActions } from '../Modal';

const renderWithTheme = (ui) =>
  render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('Modal', () => {
  it('renders children', () => {
    renderWithTheme(
      <Modal onClose={() => {}} ariaLabel="Test modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('has dialog role and aria-modal', () => {
    renderWithTheme(
      <Modal onClose={() => {}} ariaLabel="Test dialog">
        Content
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test dialog');
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal onClose={onClose} ariaLabel="Escapable">
        Content
      </Modal>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal onClose={onClose} ariaLabel="Clickable">
        Content
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when content is clicked', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal onClose={onClose} ariaLabel="Content click">
        <button>Inside</button>
      </Modal>
    );
    fireEvent.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ModalActions', () => {
  it('renders as a flex container', () => {
    renderWithTheme(
      <ModalActions data-testid="actions">
        <button>Cancel</button>
        <button>Confirm</button>
      </ModalActions>
    );
    const actions = screen.getByTestId('actions');
    expect(actions).toHaveStyle('display: flex');
  });
});
