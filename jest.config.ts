import type { Config } from 'jest';

const config: Config = {
	testEnvironment: 'node',
	transform: { '^.+\\.(ts|tsx)$': 'babel-jest' },
	roots: ['<rootDir>/src', '<rootDir>/testing'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
	moduleNameMapper: {
		'^@root/package.json$': '<rootDir>/package.json',
		'^@root(.*)$': '<rootDir>/$1',
		'^@lib/enums$': '<rootDir>/testing/__mocks__/lib_enums.ts', // <-- add this
		'^@lib(.*)$': '<rootDir>/src/lib$1',
		'^@pieces(.*)$': '<rootDir>/src/pieces$1'
	}

};
export default config;
