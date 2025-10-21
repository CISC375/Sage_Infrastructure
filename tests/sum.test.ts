import { sum } from './sum';

describe('adding two numbers', () => {
	test('adding 2 nums', () => {
		expect(sum(2, 3)).toBe(5);
	});

	test('handles negatives', () => {
		expect(sum(-1, 5)).toBe(4);
	});
});