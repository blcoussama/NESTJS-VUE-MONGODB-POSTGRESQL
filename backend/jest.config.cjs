module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.cjs',
    '**/tests/**/*.test.js'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage'
};