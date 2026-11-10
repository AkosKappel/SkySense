import { describe, expect, it } from 'vitest';
import { compass, uvLevel, windLevel } from './format.js';

describe('compass', () => {
	it.each([
		[0, 'n'],
		[22, 'n'],
		[23, 'ne'],
		[85, 'e'],
		[180, 's'],
		[248, 'w'],
		[338, 'n'],
		[360, 'n'],
		[-45, 'nw']
	])('%i degrees is %s', (degrees, point) => {
		expect(compass(degrees)).toBe(point);
	});
});

describe('levels', () => {
	it('names wind by Beaufort force', () => {
		expect([0, 2, 4, 6, 8, 12].map(windLevel)).toEqual([
			'calm',
			'light',
			'breezy',
			'windy',
			'stormy',
			'stormy'
		]);
	});

	it('names UV by the WHO bands', () => {
		expect([0, 2.9, 3, 6, 8, 11].map(uvLevel)).toEqual([
			'low',
			'low',
			'moderate',
			'high',
			'veryHigh',
			'extreme'
		]);
	});
});
