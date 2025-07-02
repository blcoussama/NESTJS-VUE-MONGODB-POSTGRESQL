module.exports = {
    testEnvironment: 'node',
    testMatch: [
      '**/tests/**/*.test.js',
      '**/src/**/*.test.js'
    ],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 10000
  };