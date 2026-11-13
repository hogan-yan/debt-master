import { fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockIsSubmitting = false;
let mockCanSubmit = true;
const mockHandleSubmit = vi.fn();

const MockField = ({
  children,
  name,
}: {
  children: (field: unknown) => React.ReactNode;
  name: string;
}) => {
  const field = {
    name,
    state: { value: '', meta: { errors: [] } },
    handleChange: vi.fn(),
    handleBlur: vi.fn(),
  };
  return <>{children(field)}</>;
};

vi.mock('@tanstack/react-form', () => ({
  useForm: () => ({
    handleSubmit: mockHandleSubmit,
    state: { isSubmitting: mockIsSubmitting, canSubmit: mockCanSubmit },
    Field: MockField,
  }),
}));

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormLabel,
  FormMessage,
  FormSubmit,
  useFormContext,
} from '../form';

describe('Form components', () => {
  beforeEach(() => {
    mockIsSubmitting = false;
    mockCanSubmit = true;
    mockHandleSubmit.mockClear();
  });

  it('renders Form with children', () => {
    render(
      <Form onSubmit={() => {}}>
        <span data-testid="child">Child</span>
      </Form>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('calls handleSubmit on form submit', () => {
    render(
      <Form onSubmit={() => {}}>
        <button type="submit">Submit</button>
      </Form>
    );
    const form = screen.getByRole('button', { name: 'Submit' }).closest('form');
    if (form) fireEvent.submit(form);
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('FormField renders children', () => {
    render(
      <FormField>
        <span data-testid="field-child">Field</span>
      </FormField>
    );
    expect(screen.getByTestId('field-child')).toBeInTheDocument();
  });

  it('FormControl renders children with field', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormControl name="test">
          {(field) => <input data-testid="input" value={field.state.value as string} readOnly />}
        </FormControl>
      </Form>
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('FormControl passes validate when provided', () => {
    const validate = () => undefined;
    render(
      <Form onSubmit={() => {}}>
        <FormControl name="test" validate={validate}>
          {(field) => <input data-testid="input" value={field.state.value as string} readOnly />}
        </FormControl>
      </Form>
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('FormControl passes transform when provided', () => {
    const transform = { input: (v: unknown) => v, output: (v: unknown) => v };
    render(
      <Form onSubmit={() => {}}>
        <FormControl name="test" transform={transform}>
          {(field) => <input data-testid="input" value={field.state.value as string} readOnly />}
        </FormControl>
      </Form>
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('FormLabel renders children', () => {
    render(<FormLabel>Name</FormLabel>);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('FormLabel shows required asterisk', () => {
    render(<FormLabel required>Name</FormLabel>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('FormMessage returns null when no children', () => {
    const { container } = render(<FormMessage />);
    expect(container.firstChild).toBeNull();
  });

  it('FormMessage renders error variant by default', () => {
    render(<FormMessage>Error text</FormMessage>);
    expect(screen.getByText('Error text')).toBeInTheDocument();
  });

  it('FormMessage renders description variant', () => {
    render(<FormMessage variant="description">Description text</FormMessage>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('FormDescription renders via FormMessage with description variant', () => {
    render(<FormDescription>Help text</FormDescription>);
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('FormSubmit renders children', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit>Save</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('FormSubmit shows Submitting... when isSubmitting', () => {
    mockIsSubmitting = true;
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit>Save</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button')).toHaveTextContent('Submitting...');
  });

  it('FormSubmit is disabled when canSubmit is false', () => {
    mockCanSubmit = false;
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit>Save</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('FormSubmit is disabled when props.disabled is true', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit disabled>Save</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('FormSubmit renders with destructive variant', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit variant="destructive">Delete</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('FormSubmit renders with outline variant', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit variant="outline">Outline</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
  });

  it('FormSubmit renders with secondary variant', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit variant="secondary">Secondary</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();
  });

  it('FormSubmit renders with ghost variant', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit variant="ghost">Ghost</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
  });

  it('FormSubmit renders with link variant', () => {
    render(
      <Form onSubmit={() => {}}>
        <FormSubmit variant="link">Link</FormSubmit>
      </Form>
    );
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
  });

  it('useFormContext throws when used outside Form', () => {
    const TestComponent = () => {
      useFormContext();
      return null;
    };
    expect(() => render(<TestComponent />)).toThrow(
      'useFormContext must be used within a Form component'
    );
  });
});
