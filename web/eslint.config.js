// Lint for the page: the TypeScript and React hooks rules, and the architecture's import rules (docs/architecture.md):
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
    files: ['src/features/**/*.tsx', 'src/pages/**/*.tsx', 'src/ui/**/*.tsx'],
    ignores: ['**/*Container.tsx', '**/*.stories.tsx', 'src/pages/App.tsx'],
    rules: { 'no-restricted-imports': restricted(APP_LAYERS, 'A presentational component gets this by props; a *Container passes it.') },
  },
  {
    // the shared parts know no feature and no page (a feature is a leaf; pages/ puts features together)
    files: ['src/ui/**/*.{ts,tsx}'],
    ignores: ['**/*.stories.tsx'],
    rules: { 'no-restricted-imports': restricted([...APP_LAYERS, '**/features/**', '**/pages/**'], 'Shared parts get this by props, and know no feature or page.') },
  },
  {
    // the app's services and hooks know no feature and no page (the page's root, pages/App.tsx, puts them together);
    // only the composition root makes the services a feature keeps for itself (features/list/views.ts, ...)
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/createApp.ts'],
    rules: { 'no-restricted-imports': restricted(['**/features/**', '**/pages/**'], 'The app layer knows no feature or page: pages/ puts them together.') },
  },
  {
    files: ['src/app/createApp.ts'],
    rules: { 'no-restricted-imports': restricted(['**/pages/**', '**/features/**/*.tsx'], 'The composition root makes services: a feature’s own (a .ts in its folder), never its components or a page.') },
  },
  {
    // containers name the parts of the app they use (useServices, useStores), never the whole of it
    files: ['src/features/**/*Container.tsx', 'src/pages/**/*Container.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: '../../app/context', importNames: ['useApp'], message: 'Name what the container uses: useServices(...) and useStores(...).' }] }],
    },
  },
  {
    // the model: pure functions and types
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': restricted(['react', 'react-dom', 'zustand*', '**/app/**', '**/stores/**', '**/api/**', '**/sync/**', '**/ui/**', '**/features/**', '**/pages/**'], 'The model is pure: no React, no stores, no I/O.'),
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'fetch'],
    },
  },
  {
    // stores, the API and sync know no React and no components
    files: ['src/stores/**/*.ts', 'src/api/**/*.ts', 'src/sync/**/*.ts'],
    rules: { 'no-restricted-imports': restricted(['react', 'react-dom', '**/features/**', '**/pages/**', '**/ui/**', '**/app/**'], 'Stores, the API and sync are plain TypeScript.') },
  },
  {
    files: ['src/main.tsx'],
    rules: { 'no-restricted-properties': 'off' }, // where the page mounts
  },
  {
    files: ['*.config.{js,ts}', '.storybook/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // the browser checks look at the page from outside: what they run in it finds its parts by the page's marks
    files: ['e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-restricted-properties': 'off' },
  },
)
