/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Load .env.test and force NODE_ENV=test BEFORE any src module is imported
  // (middleware/auth.ts and utils/prisma.ts read process.env at import time).
  setupFiles: ['<rootDir>/test/setup/env.ts'],

  // Registers module mocks (cache, whatsapp) and wires prisma connect/disconnect
  // plus the per-test database reset.
  setupFilesAfterEnv: ['<rootDir>/test/setup/jest.setup.ts'],

  // Pushes the Prisma schema to the test database once for the whole run.
  globalSetup: '<rootDir>/test/setup/global-setup.ts',

  testMatch: ['<rootDir>/test/**/*.test.ts'],

  // One Postgres database is shared by every test file, and each test truncates
  // it in beforeEach — so files must not run in parallel.
  maxWorkers: 1,

  testTimeout: 30000,
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
  },
};
