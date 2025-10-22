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

	moduleNameMapper: {
		"^@lib/(.*)$": "<rootDir>/src/lib/$1",
		"^@root/(.*)$": "<rootDir>/$1",
	},
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

