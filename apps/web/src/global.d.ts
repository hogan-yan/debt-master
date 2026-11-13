declare module '*.css' {
  const content: string;
  export default content;
}

declare global {
  // Istanbul coverage counters injected by vite-plugin-istanbul
  // eslint-disable-next-line no-var
  var __coverage__: Record<string, unknown> | undefined;
}
