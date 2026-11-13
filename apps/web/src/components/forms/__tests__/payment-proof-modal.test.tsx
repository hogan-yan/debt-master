/**
 * Tests for PaymentProofModal component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentProofModal } from '../payment-proof-modal';

describe('PaymentProofModal', () => {
  it('renders proof image and title when open', () => {
    render(
      <PaymentProofModal isOpen proofUrl="https://example.com/proof.png" onClose={() => {}} />
    );
    expect(screen.getByText('Current Payment Proof')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/proof.png');
  });

  it('does not render when closed', () => {
    const { container } = render(
      <PaymentProofModal
        isOpen={false}
        proofUrl="https://example.com/proof.png"
        onClose={() => {}}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('opens proof URL in a new tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <PaymentProofModal isOpen proofUrl="https://example.com/proof.png" onClose={() => {}} />
    );

    await user.click(screen.getByRole('button', { name: 'Open in New Tab' }));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/proof.png', '_blank');

    openSpy.mockRestore();
  });

  it('calls onClose when footer close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<PaymentProofModal isOpen proofUrl="https://example.com/proof.png" onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[closeButtons.length - 1]!);
    expect(onClose).toHaveBeenCalled();
  });
});
