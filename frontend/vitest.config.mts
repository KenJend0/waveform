import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests are plain .mjs modules with no CSS — but Vite still tries to resolve
  // postcss.config.mjs by default, which uses Tailwind v4's string-plugin
  // shorthand (Next.js-specific) that Vite's raw PostCSS loader can't parse.
  // Inline empty config skips that file entirely.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.mjs'],
  },
});
