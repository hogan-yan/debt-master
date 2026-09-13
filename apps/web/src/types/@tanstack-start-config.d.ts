// Type declaration for @tanstack/start/config
declare module '@tanstack/start/config' {
  import type { ViteConfig } from 'vite';

  const defineConfig: (config: ViteConfig) => ViteConfig;
  export default defineConfig;
}
