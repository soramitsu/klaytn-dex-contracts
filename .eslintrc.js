module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'standard',
    'airbnb-base',
    'plugin:node/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] },
    ],
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off',
    'no-console': 'off',
    'no-restricted-syntax': 'off',
    camelcase: 'off',
    'import/no-unresolved': 'off',
    'node/no-missing-import': 'off',
  },
};
