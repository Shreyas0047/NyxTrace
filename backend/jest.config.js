module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
  globalSetup: '<rootDir>/src/tests/global-setup.js',
  globalTeardown: '<rootDir>/src/tests/global-teardown.js',
  setupFiles: ['<rootDir>/src/tests/test-env.js'],
  testTimeout: 30000,
};
