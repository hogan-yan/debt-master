import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessCodeManager, deleteAccessCodeIfPresent } from './access-code-manager';

const {
  mockCreateAccessCode,
  mockDeactivateAccessCode,
  mockDeleteAccessCode,
  mockReactivateAccessCode,
} = vi.hoisted(() => ({
  mockCreateAccessCode: vi.fn(),
  mockDeactivateAccessCode: vi.fn(),
  mockDeleteAccessCode: vi.fn(),
  mockReactivateAccessCode: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  createAccessCode: mockCreateAccessCode,
  deactivateAccessCode: mockDeactivateAccessCode,
  deleteAccessCode: mockDeleteAccessCode,
  reactivateAccessCode: mockReactivateAccessCode,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AccessCodeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no access codes exist', () => {
    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={vi.fn()} />);

    expect(screen.getByText('No Access Codes')).toBeInTheDocument();
    expect(screen.getAllByText('Generate New Code')).toHaveLength(2);
  });

  it('renders table with access codes', () => {
    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: new Date('2026-01-15').toISOString(),
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('opens generate modal when button is clicked', async () => {
    const user = userEvent.setup();
    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={vi.fn()} />);

    const generateButtons = screen.getAllByRole('button', { name: 'Generate New Code' });
    const primaryGenerateButton = generateButtons[0];
    if (!primaryGenerateButton) throw new Error('Generate New Code button not found');
    await user.click(primaryGenerateButton);

    expect(screen.getByText('Generate Access Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Access Code')).toBeInTheDocument();
  });

  it('creates a new access code and refreshes', async () => {
    const user = userEvent.setup();
    mockCreateAccessCode.mockResolvedValue({
      success: true,
      accessCode: { id: 2, code: 'NEWCODE', isActive: true },
    });
    const onRefresh = vi.fn();

    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={onRefresh} />);

    const generateButtons = screen.getAllByRole('button', { name: 'Generate New Code' });
    const primaryGenerateButton = generateButtons[0];
    if (!primaryGenerateButton) throw new Error('Generate New Code button not found');
    await user.click(primaryGenerateButton);
    await user.click(screen.getByText('Create Code'));

    await waitFor(() => {
      expect(mockCreateAccessCode).toHaveBeenCalledWith({
        data: { code: expect.any(String) },
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Access code created successfully');
    });

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('reactivates an inactive code', async () => {
    const user = userEvent.setup();
    mockReactivateAccessCode.mockResolvedValue({
      success: true,
      accessCode: { id: 1, code: 'ABC123', isActive: true },
    });

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: false,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(mockReactivateAccessCode).toHaveBeenCalledWith({
        data: { id: 1 },
      });
    });
  });

  it('deactivates an active code', async () => {
    const user = userEvent.setup();
    mockDeactivateAccessCode.mockResolvedValue({ success: true });
    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);
    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(mockDeactivateAccessCode).toHaveBeenCalledWith({ data: { id: 1 } });
      expect(toast.success).toHaveBeenCalledWith('Access code deactivated');
    });
  });

  it('shows error toast when toggle status fails', async () => {
    const user = userEvent.setup();
    mockDeactivateAccessCode.mockRejectedValue(new Error('toggle failed'));

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('toggle failed');
    });
  });

  it('paginates access codes when there are more than five', () => {
    const accessCodes = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      code: `CODE${i + 1}`,
      isActive: true,
      createdAt: new Date('2026-01-01').toISOString(),
      lastUsed: null,
      createdBy: 'admin',
    }));

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    expect(screen.getByText('CODE1')).toBeInTheDocument();
    expect(screen.getByText('CODE5')).toBeInTheDocument();
    expect(screen.queryByText('CODE6')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Next' })[0]).toBeEnabled();
  });

  it('deletes an access code after confirmation', async () => {
    const user = userEvent.setup();
    mockDeleteAccessCode.mockResolvedValue({
      success: true,
      accessCode: { id: 1, code: 'ABC123', isActive: false },
    });

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    const onRefresh = vi.fn();
    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={onRefresh} />);

    await user.click(screen.getByLabelText('Delete code ABC123'));
    expect(screen.getByTestId('delete-code-modal')).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-delete-code-btn'));

    await waitFor(() => {
      expect(mockDeleteAccessCode).toHaveBeenCalledWith({
        data: { id: 1 },
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Access code deleted');
    });

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('shows error toast when delete fails', async () => {
    const user = userEvent.setup();
    mockDeleteAccessCode.mockRejectedValue(new Error('delete failed'));

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete code ABC123'));
    await user.click(screen.getByTestId('confirm-delete-code-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('delete failed');
    });
  });

  it('copies code to clipboard from table', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);
    await user.click(screen.getByLabelText('Copy code ABC123'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('ABC123');
      expect(toast.success).toHaveBeenCalledWith('Code copied to clipboard');
    });
  });

  it('shows error when clipboard copy fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
    });

    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];

    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);
    await user.click(screen.getByLabelText('Copy code ABC123'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy code');
    });
  });

  it('cancels create modal and allows custom code entry', async () => {
    const user = userEvent.setup();
    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: 'Generate New Code' })[0]!);
    expect(screen.getByTestId('generate-code-modal')).toBeInTheDocument();

    const input = screen.getByTestId('new-code-input') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'CUSTOM');
    expect(input.value).toBe('CUSTOM');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('generate-code-modal')).not.toBeInTheDocument();
  });

  it('copies the generated code from the create modal', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={vi.fn()} />);

    await user.click(screen.getAllByRole('button', { name: 'Generate New Code' })[0]!);
    await user.click(screen.getByRole('button', { name: 'Copy code' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^[A-Za-z0-9]{8}$/));
    });
  });

  it('closes the delete confirmation without deleting', async () => {
    const user = userEvent.setup();
    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];
    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    await user.click(screen.getByLabelText('Delete code ABC123'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('delete-code-modal')).not.toBeInTheDocument();
    expect(mockDeleteAccessCode).not.toHaveBeenCalled();
  });

  it('closes delete confirmation when the dialog requests close', async () => {
    const user = userEvent.setup();
    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: null,
      },
    ];
    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    expect(screen.getByText('-')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Delete code ABC123'));
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('delete-code-modal')).not.toBeInTheDocument();
  });

  it('shows error toast when create code fails', async () => {
    const user = userEvent.setup();
    mockCreateAccessCode.mockRejectedValue(new Error('create failed'));

    render(<AccessCodeManager initialAccessCodes={[]} onRefresh={vi.fn()} />);
    await user.click(screen.getAllByRole('button', { name: 'Generate New Code' })[0]!);
    await user.click(screen.getByTestId('create-code-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('create failed');
    });
  });

  it('uses translated fallback errors for non-Error create, status, and delete failures', async () => {
    const user = userEvent.setup();
    mockCreateAccessCode.mockRejectedValue('create failed');
    mockDeactivateAccessCode.mockRejectedValue('status failed');
    mockDeleteAccessCode.mockRejectedValue('delete failed');
    const accessCodes = [
      {
        id: 1,
        code: 'ABC123',
        isActive: true,
        createdAt: new Date('2026-01-01').toISOString(),
        lastUsed: null,
        createdBy: 'admin',
      },
    ];
    render(<AccessCodeManager initialAccessCodes={accessCodes} onRefresh={vi.fn()} />);

    await user.click(screen.getByText('Generate New Code'));
    await user.click(screen.getByTestId('create-code-btn'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByLabelText('Delete code ABC123'));
    await user.click(screen.getByTestId('confirm-delete-code-btn'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to create access code');
      expect(toast.error).toHaveBeenCalledWith('Failed to update access code');
      expect(toast.error).toHaveBeenCalledWith('Failed to update access code');
    });
  });
});

describe('deleteAccessCodeIfPresent', () => {
  it('does not invoke deletion without a selected code', async () => {
    const deleteCode = vi.fn();
    const onDeleted = vi.fn();

    await deleteAccessCodeIfPresent(null, deleteCode, onDeleted);
    expect(deleteCode).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('deletes the selected code', async () => {
    const deleteCode = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const code = {
      id: 1,
      code: 'ABC123',
      isActive: true,
      createdAt: '2026-01-01',
      lastUsed: null,
      createdBy: 'admin',
    };

    await deleteAccessCodeIfPresent(code, deleteCode, onDeleted);
    expect(deleteCode).toHaveBeenCalledWith({ data: { id: 1 } });
    expect(onDeleted).toHaveBeenCalled();
  });
});
