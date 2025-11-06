const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
	testEnvironment: "node",
	transform: {
		...tsJestTransformCfg,
	},

	testMatch: ['**/__test__/**/*.test.ts', '**/?(*.)+(spec|test).ts?(x)'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	// Run setup before any test files are loaded so virtual mocks apply to module resolution
	setupFiles: ['<rootDir>/jest.setup.ts'],
	moduleNameMapper: {
		"^@lib/(.*)$": "<rootDir>/src/lib/$1",
		"^@root/config$": "<rootDir>/config.ts",
		"^@root/(.*)$": "<rootDir>/$1",
	},
	moduleDirectories: ['node_modules', '<rootDir>'],
	modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/build'],
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
};

