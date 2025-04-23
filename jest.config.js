/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleNameMapper: {
		'^@root/(.*)$': '<rootDir>/$1',
		'^@lib/(.*)$': '<rootDir>/src/lib/$1',
		'^@pieces/(.*)$': '<rootDir>/src/pieces/$1',
	},
	globals: {
		'ts-jest': {
		  tsconfig: './tsconfig.json',
		},
	  },
  };
   