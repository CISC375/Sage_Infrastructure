/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	transform: {
	  '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
	},
	moduleNameMapper: {
	  '^@root/(.*)$': '<rootDir>/$1',
	  '^@lib/(.*)$': '<rootDir>/src/lib/$1',
	  '^@pieces/(.*)$': '<rootDir>/src/pieces/$1',
	},
  };
  
   