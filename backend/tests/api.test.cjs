const { describe, test, expect } = require('@jest/globals');

describe('Backend API Tests', () => {
  test('basic functionality test', () => {
    expect(1 + 1).toBe(2);
  });

  test('environment check', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('async functionality', async () => {
    const result = await Promise.resolve('test-passed');
    expect(result).toBe('test-passed');
  });
});