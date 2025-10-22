const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
    testEnvironment: "node",
    transform: {
        ...tsJestTransformCfg,
    },
    // This is the part you need to add
    moduleNameMapper: {
        "^@lib/(.*)$": "<rootDir>/src/lib/$1",
        "^@root/(.*)$": "<rootDir>/$1",
    },
};