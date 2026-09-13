import { Checkbox } from './checkbox';
import { FormControl, FormField, FormLabel, FormMessage } from './form';
import { Input } from './input';
import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Textarea } from './textarea';

type Validator<T = unknown> = (params: { value: T }) => string | undefined;

// Input field adapter
interface FormInputProps {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  description?: string;
  validate?: Validator<string>;
  step?: string;
  min?: string;
  max?: string;
  list?: string;
  'data-testid'?: string;
}

export function FormInput({
  name,
  label,
  placeholder,
  required,
  type = 'text',
  description,
  validate,
  step,
  min,
  max,
  list,
  'data-testid': dataTestId,
}: FormInputProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={name} required={required}>
          {label}
        </FormLabel>
      )}
      {description && (
        <FormMessage variant="description" id={descId}>
          {description}
        </FormMessage>
      )}
      <FormControl name={name} validate={validate}>
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;
          return (
            <>
              <Input
                id={name}
                type={type}
                placeholder={placeholder}
                value={field.state.value || ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required={required}
                step={step}
                min={min}
                max={max}
                list={list}
                data-testid={dataTestId}
                aria-invalid={hasErrors}
                aria-describedby={describedBy}
              />
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}

// Textarea field adapter
interface FormTextareaProps {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  description?: string;
  validate?: Validator<string>;
  'data-testid'?: string;
}

export function FormTextarea({
  name,
  label,
  placeholder,
  required,
  rows = 3,
  description,
  validate,
  'data-testid': dataTestId,
}: FormTextareaProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={name} required={required}>
          {label}
        </FormLabel>
      )}
      {description && (
        <FormMessage variant="description" id={descId}>
          {description}
        </FormMessage>
      )}
      <FormControl name={name} validate={validate}>
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;
          return (
            <>
              <Textarea
                id={name}
                placeholder={placeholder}
                rows={rows}
                value={field.state.value || ''}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required={required}
                aria-invalid={hasErrors}
                aria-describedby={describedBy}
                data-testid={dataTestId}
              />
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}

// Select field adapter
interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options: FormSelectOption[];
  description?: string;
  validate?: Validator<string>;
  'data-testid'?: string;
}

export function FormSelect({
  name,
  label,
  placeholder,
  required,
  options,
  description,
  validate,
  'data-testid': dataTestId,
}: FormSelectProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      {label && (
        <FormLabel htmlFor={name} required={required}>
          {label}
        </FormLabel>
      )}
      {description && (
        <FormMessage variant="description" id={descId}>
          {description}
        </FormMessage>
      )}
      <FormControl name={name} validate={validate}>
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;
          return (
            <>
              <Select value={field.state.value || ''} onValueChange={field.handleChange}>
                <SelectTrigger
                  aria-invalid={hasErrors}
                  aria-describedby={describedBy}
                  data-testid={dataTestId}
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-testid={`select-option-${option.value}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}

// Checkbox field adapter
interface FormCheckboxProps {
  name: string;
  label?: string;
  description?: string;
  validate?: Validator<string>;
}

export function FormCheckbox({ name, label, description, validate }: FormCheckboxProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      <FormControl name={name} validate={validate}>
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;
          return (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={name}
                  checked={field.state.value || false}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  aria-invalid={hasErrors}
                  aria-describedby={describedBy}
                />
                {label && <Label htmlFor={name}>{label}</Label>}
              </div>
              {description && (
                <FormMessage variant="description" id={descId}>
                  {description}
                </FormMessage>
              )}
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}

// Checkbox group field adapter for arrays
interface FormCheckboxGroupOption {
  value: string | number;
  label: string;
  id?: string | number;
}

interface FormCheckboxGroupProps {
  name: string;
  label?: string;
  options: FormCheckboxGroupOption[];
  description?: string;
  validate?: Validator<Array<string | number>>;
}

export function FormCheckboxGroup({
  name,
  label,
  options,
  description,
  validate,
}: FormCheckboxGroupProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      {label && <FormLabel required>{label}</FormLabel>}
      {description && (
        <FormMessage variant="description" id={descId}>
          {description}
        </FormMessage>
      )}
      <FormControl name={name} validate={validate}>
        {(field) => {
          const currentValues = field.state.value || [];
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;

          const handleCheckboxChange = (optionValue: string | number, checked: boolean) => {
            let newValues: (string | number)[];
            if (checked) {
              newValues = [...currentValues, optionValue];
            } else {
              newValues = currentValues.filter((val: string | number) => val !== optionValue);
            }
            field.handleChange(newValues);
          };

          return (
            <>
              <div
                className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border border-border rounded-md p-3"
                role="group"
                aria-describedby={describedBy}
              >
                {options.map((option) => {
                  const isChecked = currentValues.includes(option.value);
                  const checkboxId = `${name}-${option.id || option.value}`;

                  return (
                    <div key={checkboxId} className="flex items-center space-x-2">
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(option.value, checked === true)
                        }
                        aria-invalid={hasErrors}
                      />
                      <Label htmlFor={checkboxId}>{option.label}</Label>
                    </div>
                  );
                })}
              </div>
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}

// Radio group field adapter
interface FormRadioOption {
  value: string;
  label: string;
}

interface FormRadioGroupProps {
  name: string;
  label?: string;
  options: FormRadioOption[];
  required?: boolean;
  description?: string;
  validate?: Validator<string>;
}

export function FormRadioGroup({
  name,
  label,
  options,
  required,
  description,
  validate,
}: FormRadioGroupProps) {
  const errorId = `${name}-error`;
  const descId = `${name}-description`;

  return (
    <FormField>
      {label && <FormLabel required={required}>{label}</FormLabel>}
      {description && (
        <FormMessage variant="description" id={descId}>
          {description}
        </FormMessage>
      )}
      <FormControl name={name} validate={validate}>
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0;
          const describedBy =
            [description ? descId : '', hasErrors ? errorId : ''].filter(Boolean).join(' ') ||
            undefined;
          return (
            <>
              <RadioGroup
                value={field.state.value || ''}
                onValueChange={field.handleChange}
                aria-describedby={describedBy}
              >
                {options.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`${name}-${option.value}`} />
                    <Label htmlFor={`${name}-${option.value}`}>{option.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {hasErrors && (
                <FormMessage id={errorId}>{field.state.meta.errors.join(', ')}</FormMessage>
              )}
            </>
          );
        }}
      </FormControl>
    </FormField>
  );
}
