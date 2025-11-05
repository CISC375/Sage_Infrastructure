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
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // このパスは任意です
	moduleNameMapper: {
		"^@lib/(.*)$": "<rootDir>/src/lib/$1",
		// Explicit mapping to avoid extension resolution issues on CI
		"^@root/config$": "<rootDir>/config.ts",
		"^@root/(.*)$": "<rootDir>/$1",
	},
	// Help Jest resolve absolute imports from project root
	moduleDirectories: ['node_modules', '<rootDir>'],
	// Ensure Jest ignores compiled output when resolving modules and manual mocks
	modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/build'],
	testPathIgnorePatterns: ["/node_modules/", "/dist/", "/build/"],
};

