import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    rules: {
      /* catch (e) {} is used on purpose around localStorage, which throws in
         private mode; there is nothing to do with the error */
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    /* The site ships plain scripts with no bundler: each file runs as a
       classic <script> and shares one namespace, window.SK. */
    files: ['assets/**/*.js', '*/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, SK: 'writable' }
    }
  },
  {
    files: ['regex/regex-worker.js'],
    languageOptions: { globals: globals.worker }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node }
  },
  {
    files: ['eslint.config.mjs'],
    languageOptions: { sourceType: 'module' }
  }
];
