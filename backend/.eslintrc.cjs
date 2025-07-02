module.exports = {
    env: {
      node: true,
      es2022: true,
      jest: true
    },
    extends: [
      'eslint:recommended'
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-console': 'off',        // ← Allow console.log in development
      'no-unused-vars': 'error',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  };
  