// .eslintrc.js (root)
module.exports = {
    root: true,
    env: {
      node: true,
      es2022: true
    },
    extends: [
      'eslint:recommended'
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    ignorePatterns: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/'
    ]
  };
  
  // backend/.eslintrc.js
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
      'no-console': 'warn',
      'no-unused-vars': 'error',
      'prefer-const': 'error',
      'no-var': 'error'
    }
  };
  
  // frontend/.eslintrc.js
  module.exports = {
    env: {
      browser: true,
      es2022: true,
      node: true
    },
    extends: [
      'eslint:recommended',
      '@vitejs/eslint-config-react'
    ],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true
      }
    },
    plugins: [
      'react',
      'react-hooks'
    ],
    rules: {
      'react/prop-types': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'error',
      'prefer-const': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  };
  
  // .prettierrc (code formatting)
  {
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 80,
    "tabWidth": 2,
    "useTabs": false
  }
  
  // .prettierignore
  node_modules/
  dist/
  build/
  coverage/
  *.min.js
  *.min.css