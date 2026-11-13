/**
 * Expense form validation helpers using Zod schema
 */

type SafeParseResult = {
  success: boolean;
  error?: { issues: Array<{ message?: string }> };
};

type FieldParseFn = (value: unknown) => SafeParseResult;

export function createExpenseFieldValidator(
  parseFn: FieldParseFn
): (props: { value: unknown }) => string | undefined {
  return ({ value }) => {
    const result = parseFn(value);
    return result.success ? undefined : result.error?.issues[0]?.message;
  };
}
