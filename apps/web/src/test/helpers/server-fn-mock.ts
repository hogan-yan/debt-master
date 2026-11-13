/**
 * Shared mock builder for TanStack Start's createServerFn.
 *
 * Usage in test files (vi.mock is still required at top level):
 * ```ts
 * vi.mock('@tanstack/react-start', () => ({
 *   createServerFn: () => createMockServerFnBuilder(),
 * }));
 * ```
 */

export interface MockServerFnBuilder {
  validator: (fn: (data: unknown) => unknown) => MockServerFnBuilder;
  inputValidator: (fn: (data: unknown) => unknown) => MockServerFnBuilder;
  handler: (
    handlerFn: (ctx: { data: unknown }) => Promise<unknown>
  ) => (ctx: { data: unknown }) => Promise<unknown>;
}

export function createMockServerFnBuilder(): MockServerFnBuilder {
  let validatorFn: ((data: unknown) => unknown) | undefined;
  const setValidator = (fn: (data: unknown) => unknown) => {
    validatorFn = fn;
    return builder;
  };
  const builder: MockServerFnBuilder = {
    validator: setValidator,
    inputValidator: setValidator,
    handler:
      (handlerFn) =>
      async (ctx = { data: {} }) => {
        const data = ctx.data ?? {};
        const validated = typeof validatorFn === 'function' ? await validatorFn(data) : data;
        return handlerFn({ data: validated });
      },
  };
  return builder;
}
