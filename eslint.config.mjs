// eslint.config.mjs
// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Put your ignore patterns here instead of .eslintignore
const ignores = ['node_modules/**', 'dist/**', 'build/**'];

export default tseslint.config(
  {
    // ESLint's built-in recommended rules
    ...eslint.configs.recommended,
    ignores,
  },
  // TypeScript-ESLint's recommended rules, with the same ignores applied
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    ignores,
  })),
);
