// ESLint flat config for React + TypeScript.
// Rules here back up the react-principles and html-syntax-and-semantics skills.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist', 'build', 'coverage', '.next', 'node_modules', 'CHANGELOG.md'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { react: { version: 'detect' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hooks (react-principles, Part 3)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React
      'react/jsx-key': 'error',
      'react/no-danger': 'warn',
      'react/self-closing-comp': 'warn',
      'react/prop-types': 'off', // TypeScript types replace prop-types
      'react/jsx-no-target-blank': 'error',

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // General
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
];
