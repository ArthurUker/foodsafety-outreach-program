import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'backend/node_modules/**', 'legacy/**'],
  },
  {
    files: ['backend/**/*.js', 'js/**/*.js', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['js/**/*.js', 'scripts/smoke-render.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ['backend/routes/inquiryRoutes.js'],
    rules: {
      // CSV 开头的 UTF-8 BOM 用于让 Excel 正确识别中文。
      'no-irregular-whitespace': 'off',
    },
  },
];
