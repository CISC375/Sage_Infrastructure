const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
	testEnvironment: "node",

	// Only look for tests in the source folder
	roots: ["<rootDir>/src"],

	// Ignore compiled files
	modulePathIgnorePatterns: ["<rootDir>/dist/"],

	transform: {
		...tsJestTransformCfg,
	},

	moduleNameMapper: {
		"^@lib/(.*)$": "<rootDir>/src/lib/$1",
		"^@root/(.*)$": "<rootDir>/$1",
	},

	// Optional: restrict Jest to only test files ending in .test.ts or .spec.ts
	// testMatch: ["**/__test__/**/*.test.[jt]s?(x)"],
};
