// Lint for the page: the TypeScript and React hooks rules, and the architecture's import rules (ARCHITECTURE.md):
// presentational components take everything by props, the model is pure, stores and the API know no React. What
// a lint rule cannot say is checked by scripts/check-architecture.mjs. Containers name the parts of the app they use.

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const APP_LAYERS = ['**/app/**', '**/stores/**', '**/api/**', '**/sync/**']
const restricted = (patterns, message) => ['error', { patterns: [{ group: patterns, message }] }]
const NO_PAGE_LOOKUPS = ['error',
  { object: 'document', property: 'querySelector', message: 'Use a ref.' },
  { object: 'document', property: 'querySelectorAll', message: 'Use refs.' },
  { object: 'document', property: 'getElementById', message: 'Use a ref.' },
  { object: 'document', property: 'getElementsByClassName', message: 'Use refs.' },
]

export default tseslint.config(
  { ignores: ['dist', 'dist-storybook', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-properties': NO_PAGE_LOOKUPS,
    },
  },
  {
    // presentational components: props only
    files: ['src/features/**/*.tsx', 'src/ui/**/*.tsx'],
    ignores: ['**/*Container.tsx', '**/*.stories.tsx'],
    rules: { 'no-restricted-imports': restricted(APP_LAYERS, 'A presentational component gets this by props; a *Container passes it.') },
  },
  {
    // containers name the parts of the app they use (useServices, useStores), never the whole of it
    files: ['src/features/**/*Container.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: '../../app/context', importNames: ['useApp'], message: 'Name what the container uses: useServices(...) and useStores(...).' }] }],
    },
  },
  {
    // the model: pure functions and types
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted(['react', 'react-dom', 'zustand*', '**/app/**', '**/stores/**', '**/api/**', '**/sync/**', '**/ui/**', '**/features/**'], 'The model is pure: no React, no stores, no I/O.'),
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'fetch'],
    },
  },
  {
    // stores, the API and sync know no React and no components
    files: ['src/stores/**/*.ts', 'src/api/**/*.ts', 'src/sync/**/*.ts'],
    rules: { 'no-restricted-imports': restricted(['react', 'react-dom', '**/features/**', '**/ui/**', '**/app/**'], 'Stores, the API and sync are plain TypeScript.') },
  },
  {
    files: ['src/main.tsx'],
    rules: { 'no-restricted-properties': 'off' }, // where the page mounts
  },
  {
    files: ['*.config.{js,ts}', '.storybook/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
)
