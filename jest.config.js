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

	  resetModules: false,

    moduleNameMapper: {
        "^@lib/(.*)$": "<rootDir>/src/lib/$1",
        "^@root/(.*)$": "<rootDir>/$1",
    },
};
