/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/src/**/*.test.ts", "**/tests/**/*.test.ts"],
	moduleFileExtensions: ["ts", "js", "json"],
};
