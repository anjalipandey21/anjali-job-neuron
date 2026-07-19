import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import globals from 'globals'

const vitestGlobals = {
  describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
  beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly', afterAll: 'readonly',
  vi: 'readonly',
}

export default [
  // ── Ignore patterns ─────────────────────────────────────────────────────────
  {
    ignores: ['node_modules/**', 'dist/**', '.worktrees/**'],
  },

  // ── Frontend source (ESM, browser + React) ──────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',        // React 17+ — no import needed
      'react/prop-types': 'off',               // JS project, no PropTypes enforcement
      'react/no-unescaped-entities': 'warn',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',               // intentional — strips PDF/DOCX control chars
      'react-hooks/set-state-in-effect': 'off', // calling setState in effects is valid React
    },
  },

  // ── Frontend tests (ESM, jsdom + Vitest globals) ────────────────────────────
  {
    files: ['src/__tests__/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...vitestGlobals },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },

  // ── Netlify Functions source (CommonJS, Node) ────────────────────────────────
  {
    files: ['netlify/functions/**/*.js'],
    ignores: ['netlify/functions/__tests__/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ── Netlify Function tests (mixed ESM/CJS — Node + Vitest globals) ───────────
  {
    files: ['netlify/functions/__tests__/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',   // most test files use ESM; CJS ones use explicit require()
      globals: { ...globals.node, ...vitestGlobals },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
]
