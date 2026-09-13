/**
 * Tests for SplitTypeSelector component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SplitTypeSelector } from '../split-type-selector';

describe('SplitTypeSelector', () => {
  it('renders both split type options', () => {
    render(<SplitTypeSelector value="ITEMIZED" onChange={() => {}} />);
    expect(screen.getByLabelText(/Itemized/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Split equally/)).toBeInTheDocument();
  });

  it('calls onChange with the correct value when clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SplitTypeSelector value="ITEMIZED" onChange={onChange} />);

    await user.click(screen.getByLabelText(/Split equally/));
    expect(onChange).toHaveBeenCalledWith('EQUAL');
  });

  it('shows the correct value as selected', () => {
    render(<SplitTypeSelector value="EQUAL" onChange={() => {}} />);
    expect(screen.getByLabelText(/Split equally/)).toBeChecked();
  });
});
