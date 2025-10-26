const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  // Environment for Node-based code
  testEnvironment: "node",

  // Tell Jest to use ts-jest to handle TypeScript files
  transform: {
    ...tsJestTransformCfg,
  },

  // Run this file before all tests
  setupFilesAfterEnv: ['<rootDir>/__tests__/test-setup.ts'],

  // Allow Jest to understand TypeScript path aliases
  moduleNameMapper: {
    "^@root/(.*)$": "<rootDir>/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@pieces/(.*)$": "<rootDir>/src/pieces/$1",
  },

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // 👇 Prevent Jest from treating the setup file as a test
  testPathIgnorePatterns: ["/node_modules/", "__tests__/test-setup.ts"],
};
