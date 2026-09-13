import type { Config } from 'postcss-load-config';

// @tailwindcss/vite now handles Tailwind as a Vite plugin.
// autoprefixer is kept for other CSS compat needs.
const config: Config = {
  plugins: {
    autoprefixer: {},
  },
};

export default config;
