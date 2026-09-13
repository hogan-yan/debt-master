import type { AnyFieldApi, AnyFormApi } from '@tanstack/form-core';
import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { registerFormDebug } from './payment-form-guards';

// Type definition for generic form API to use in contexts
// Uses unknown and undefined for all generic params since we don't know the specific form shape
type AnyReactFormApi = ReactFormExtendedApi<
  unknown,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  Record<string, unknown>
>;

// Generic form context for accessing form API in child components
const formDebugMap = new WeakMap<HTMLFormElement, AnyReactFormApi>();

const FormContext = React.createContext<AnyReactFormApi | null>(null);

export function useFormContext() {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
}

// Form component wrapper for TanStack Form
interface FormProps<TFormData> {
  children: React.ReactNode;
  onSubmit: (values: TFormData, formApi: AnyFormApi) => void | Promise<void>;
  defaultValues?: { [K in keyof TFormData]?: TFormData[K] | undefined };
  className?: string;
}

export function Form<TFormData = Record<string, unknown>>({
  children,
  onSubmit,
  defaultValues,
  className,
  ...props
}: FormProps<TFormData>) {
  const form = useForm({
    defaultValues: defaultValues as TFormData,
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(value, formApi);
    },
  });

  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    registerFormDebug(formRef.current, form, formDebugMap);
  }, [form]);

  return (
    <FormContext.Provider value={form as AnyReactFormApi}>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className={cn('space-y-6', className)}
        {...props}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
}

// Form field wrapper component
interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn('space-y-2', className)}>{children}</div>;
}

// Union type for validators to work around contravariance with exactOptionalPropertyTypes
export type FieldValidator =
  | ((params: { value: string }) => string | undefined)
  | ((params: { value: number }) => string | undefined)
  | ((params: { value: boolean }) => string | undefined)
  | ((params: { value: Array<string | number> }) => string | undefined)
  | ((params: { value: unknown }) => string | undefined);

// Form control component for field value and validation
interface FormControlProps {
  children: (field: AnyFieldApi) => React.ReactNode;
  name: string;
  validate?: FieldValidator | undefined;
  transform?: {
    input?: (value: unknown) => unknown;
    output?: (value: unknown) => unknown;
  };
}

export function FormControl({ children, name, validate, transform }: FormControlProps) {
  const form = useFormContext();

  return (
    <form.Field
      name={name}
      {...(validate
        ? { validators: { onChange: validate as (props: { value: unknown }) => unknown } }
        : {})}
      {...(transform ? { transform } : {})}
    >
      {children}
    </form.Field>
  );
}

// Form label component
interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean | undefined;
}

export function FormLabel({ children, required, className, ...props }: FormLabelProps) {
  return (
    <Label className={cn('text-sm font-medium', className)} {...props}>
      {children}
      {required && <span className="text-destructive-text ml-1">*</span>}
    </Label>
  );
}

// Form message component for errors and descriptions
interface FormMessageProps {
  children?: React.ReactNode;
  className?: string | undefined;
  variant?: 'error' | 'description';
  id?: string | undefined;
}

export function FormMessage({ children, className, variant = 'error', id }: FormMessageProps) {
  if (!children) return null;

  return (
    <p
      id={id}
      className={cn(
        'text-sm',
        variant === 'error' && 'text-destructive-text font-medium',
        variant === 'description' && 'text-muted-foreground',
        className
      )}
    >
      {children}
    </p>
  );
}

// Form description component
interface FormDescriptionProps {
  children: React.ReactNode;
  className?: string | undefined;
}

export function FormDescription({ children, className }: FormDescriptionProps) {
  return (
    <FormMessage variant="description" className={className}>
      {children}
    </FormMessage>
  );
}

// Submit button component that automatically handles form state
interface FormSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function FormSubmit({
  children,
  className,
  variant = 'default',
  onClick,
  ...props
}: FormSubmitProps) {
  const form = useFormContext();
  const isSubmitting = form.state.isSubmitting;
  const canSubmit = form.state.canSubmit;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Some automation tools and browsers do not reliably trigger the native
    // form submit from a programmatic button click. Explicitly drive the
    // TanStack Form submission so the form always submits.
    e.preventDefault();
    e.stopPropagation();
    void form.handleSubmit();
    onClick?.(e);
  };

  return (
    <button
      type="submit"
      disabled={!canSubmit || isSubmitting || props.disabled}
      className={cn(
        'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95',
        'h-9 px-4 py-2 has-[>svg]:px-3',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'destructive' &&
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        variant === 'outline' &&
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        variant === 'secondary' &&
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
        variant === 'link' && 'text-primary underline-offset-4 hover:underline',
        className
      )}
      {...props}
      onClick={handleClick}
    >
      {isSubmitting ? 'Submitting...' : children}
    </button>
  );
}

export type { AnyFieldApi as FieldApi, AnyFormApi as FormApi };
export { useForm };
