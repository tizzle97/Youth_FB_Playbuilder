import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain-JS Node scripts: seed-library, one-off migrations, the Edge
    // Function *.check.mjs guards. Without Node globals declared, every
    // `process`/`console`/`URL` reference is a `no-undef` error — that was
    // 56 of the repo's 57 lint errors and the reason `npm run verify` could
    // never pass. TS files don't need this: typescript-eslint turns
    // `no-undef` off there because tsc already checks it.
    // Browser globals are included alongside Node's because the seed-library
    // scripts drive headless Chromium: code inside `page.evaluate()` callbacks
    // runs in the page, so `window`/`localStorage` there are real, not typos.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Codebase leans on `any` heavily around untyped Supabase query results;
      // keep it visible without blocking `npm run lint` (see BACKLOG.md B-6).
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
