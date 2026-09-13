import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FormCheckbox,
  FormCheckboxGroup,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormTextarea,
} from '../form-fields';

// Mutable mock field state
let mockFieldValue: unknown = '';
let mockFieldErrors: string[] = [];

const mockHandleChange = vi.fn();
const mockHandleBlur = vi.fn();

vi.mock('@/components/ui/form', () => ({
  FormField: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-field">{children}</div>
  ),
  FormLabel: ({
    children,
    htmlFor,
    required,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    required?: boolean;
  }) => (
    <label htmlFor={htmlFor} data-required={required}>
      {children}
      {required && <span>*</span>}
    </label>
  ),
  FormMessage: ({
    children,
    variant,
    id,
  }: {
    children: React.ReactNode;
    variant?: string;
    id?: string;
  }) => (
    <span data-testid="form-message" data-variant={variant} id={id}>
      {children}
    </span>
  ),
  FormControl: ({ children }: { children: (field: unknown) => React.ReactNode }) => {
    const mockField = {
      state: {
        value: mockFieldValue,
        meta: { errors: mockFieldErrors },
      },
      handleChange: mockHandleChange,
      handleBlur: mockHandleBlur,
    };
    return <>{children(mockField)}</>;
  },
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (
    props: React.InputHTMLAttributes<HTMLInputElement> & {
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }
  ) => (
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(e) => props.onCheckedChange?.(e.target.checked)}
      data-testid="checkbox-input"
    />
  ),
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: (
    props: React.HTMLAttributes<HTMLDivElement> & {
      value?: string;
      onValueChange?: (value: string) => void;
    }
  ) => <div data-testid="radio-group">{props.children}</div>,
  RadioGroupItem: (props: React.InputHTMLAttributes<HTMLInputElement> & { value: string }) => (
    <input type="radio" value={props.value} data-testid={`radio-${props.value}`} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { value: string }) => (
    <div data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectTrigger: (props: React.HTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor="test" {...props}>
      {props.children}
    </label>
  ),
}));

describe('FormInput', () => {
  beforeEach(() => {
    mockFieldValue = '';
    mockFieldErrors = [];
    mockHandleChange.mockClear();
    mockHandleBlur.mockClear();
  });

  it('renders metadata and error state', () => {
    mockFieldErrors = ['Required'];
    render(
      <FormInput
        name="amount"
        label="Amount"
        description="Enter an amount"
        required
        type="number"
        step="0.01"
        min="0"
        max="100"
        list="amounts"
        data-testid="amount-input"
      />
    );

    const input = screen.getByTestId('amount-input');
    expect(input).toHaveAttribute('aria-describedby', 'amount-description amount-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('step', '0.01');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('updates and blurs input fields', () => {
    render(<FormInput name="name" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.blur(input);
    expect(mockHandleChange).toHaveBeenCalledWith('Alice');
    expect(mockHandleBlur).toHaveBeenCalledOnce();
  });
});

describe('FormTextarea', () => {
  beforeEach(() => {
    mockFieldValue = '';
    mockFieldErrors = [];
    mockHandleChange.mockClear();
    mockHandleBlur.mockClear();
  });

  it('renders metadata and error state', () => {
    mockFieldErrors = ['Too short'];
    render(
      <FormTextarea
        name="notes"
        label="Notes"
        description="Add details"
        required
        rows={5}
        data-testid="notes-input"
      />
    );

    const input = screen.getByTestId('notes-input');
    expect(input).toHaveAttribute('aria-describedby', 'notes-description notes-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('rows', '5');
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('updates and blurs textarea fields', () => {
    render(<FormTextarea name="notes" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Details' } });
    fireEvent.blur(input);
    expect(mockHandleChange).toHaveBeenCalledWith('Details');
    expect(mockHandleBlur).toHaveBeenCalledOnce();
  });
});

describe('FormSelect', () => {
  beforeEach(() => {
    mockFieldValue = '';
    mockFieldErrors = ['Choose one'];
  });

  it('renders label, description, options, and error state', () => {
    render(
      <FormSelect
        name="category"
        label="Category"
        description="Select a category"
        required
        placeholder="Choose"
        data-testid="category-select"
        options={[
          { value: 'food', label: 'Food' },
          { value: 'travel', label: 'Travel' },
        ]}
      />
    );

    expect(screen.getByTestId('category-select')).toHaveAttribute(
      'aria-describedby',
      'category-description category-error'
    );
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('Choose one')).toBeInTheDocument();
  });

  it('omits aria description when no description or errors exist', () => {
    mockFieldErrors = [];
    render(
      <FormSelect
        name="category"
        options={[{ value: 'food', label: 'Food' }]}
        data-testid="category-select"
      />
    );

    expect(screen.getByTestId('category-select')).not.toHaveAttribute('aria-describedby');
  });
});

describe('FormCheckbox', () => {
  beforeEach(() => {
    mockFieldValue = false;
    mockFieldErrors = [];
    mockHandleChange.mockClear();
    mockHandleBlur.mockClear();
  });

  it('renders checkbox without label', () => {
    render(<FormCheckbox name="test" />);
    expect(screen.getByTestId('checkbox-input')).toBeInTheDocument();
    expect(screen.queryByText('Test Label')).not.toBeInTheDocument();
  });

  it('renders checkbox with label', () => {
    render(<FormCheckbox name="test" label="Test Label" />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<FormCheckbox name="test" description="A helpful description" />);
    expect(screen.getByText('A helpful description')).toBeInTheDocument();
  });

  it('shows error message when there are errors', () => {
    mockFieldErrors = ['This field is required'];
    render(<FormCheckbox name="test" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('calls handleChange when checkbox toggled', () => {
    mockFieldValue = false;
    render(<FormCheckbox name="test" />);
    const checkbox = screen.getByTestId('checkbox-input');
    fireEvent.click(checkbox);
    expect(mockHandleChange).toHaveBeenCalled();
  });

  it('checks checkbox when field value is true', () => {
    mockFieldValue = true;
    render(<FormCheckbox name="test" />);
    const checkbox = screen.getByTestId('checkbox-input') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

describe('FormCheckboxGroup', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  beforeEach(() => {
    mockFieldValue = [];
    mockFieldErrors = [];
    mockHandleChange.mockClear();
  });

  it('renders checkboxes for all options', () => {
    render(<FormCheckboxGroup name="group" options={options} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<FormCheckboxGroup name="group" options={options} label="Group Label" />);
    expect(screen.getByText('Group Label')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<FormCheckboxGroup name="group" options={options} description="Pick some" />);
    expect(screen.getByText('Pick some')).toBeInTheDocument();
  });

  it('shows error message when there are errors', () => {
    mockFieldErrors = ['Select at least one'];
    render(<FormCheckboxGroup name="group" options={options} />);
    expect(screen.getByText('Select at least one')).toBeInTheDocument();
  });

  it('checks options that are in field value', () => {
    mockFieldValue = ['a'];
    render(<FormCheckboxGroup name="group" options={options} />);
    const checkboxes = screen.getAllByTestId('checkbox-input') as HTMLInputElement[];
    // First checkbox should be checked (value 'a' is in the array)
    expect(checkboxes[0]!.checked).toBe(true);
  });

  it('treats a missing field value as an empty selection', () => {
    mockFieldValue = null;
    render(<FormCheckboxGroup name="group" options={options} />);

    const checkboxes = screen.getAllByTestId('checkbox-input') as HTMLInputElement[];
    expect(checkboxes[0]!.checked).toBe(false);
    expect(checkboxes[1]!.checked).toBe(false);
  });

  it('calls handleChange with updated values when option checked', () => {
    mockFieldValue = [];
    render(<FormCheckboxGroup name="group" options={options} />);
    const checkboxes = screen.getAllByTestId('checkbox-input');
    fireEvent.click(checkboxes[0]!);
    expect(mockHandleChange).toHaveBeenCalled();
  });

  it('calls handleChange with updated values when option unchecked', () => {
    mockFieldValue = ['a', 'b'];
    render(<FormCheckboxGroup name="group" options={options} />);
    const checkboxes = screen.getAllByTestId('checkbox-input');
    fireEvent.click(checkboxes[0]!);
    expect(mockHandleChange).toHaveBeenCalled();
  });

  it('uses id from option when provided', () => {
    const optionsWithId = [{ value: 'x', label: 'X', id: 99 }];
    render(<FormCheckboxGroup name="group" options={optionsWithId} />);
    expect(screen.getByText('X')).toBeInTheDocument();
  });
});

describe('FormRadioGroup', () => {
  const options = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  beforeEach(() => {
    mockFieldValue = '';
    mockFieldErrors = [];
    mockHandleChange.mockClear();
  });

  it('renders radio buttons for all options', () => {
    render(<FormRadioGroup name="choice" options={options} />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<FormRadioGroup name="choice" options={options} label="Choose" />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<FormRadioGroup name="choice" options={options} description="Pick one" />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows error message when there are errors', () => {
    mockFieldErrors = ['Required'];
    render(<FormRadioGroup name="choice" options={options} />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('sets radio group value from field state', () => {
    mockFieldValue = 'yes';
    render(<FormRadioGroup name="choice" options={options} />);
    expect(screen.getByTestId('radio-group')).toBeInTheDocument();
  });

  it('passes onValueChange to radio group', () => {
    render(<FormRadioGroup name="choice" options={options} />);
    expect(screen.getByTestId('radio-group')).toBeInTheDocument();
  });
});
