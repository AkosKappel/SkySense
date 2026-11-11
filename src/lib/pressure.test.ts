import { describe, expect, it } from 'vitest';
import { pressureAt, pressureTrend } from './pressure.js';

describe('pressureTrend', () => {
	it('calls small changes steady, as model values jitter by a few tenths', () => {
		expect(pressureTrend(0)).toBe('steady');
		expect(pressureTrend(1.5)).toBe('steady');
		expect(pressureTrend(-1.5)).toBe('steady');
	});

	it('names rising and falling, and quick changes', () => {
		expect(pressureTrend(1.6)).toBe('rising');
		expect(pressureTrend(-2)).toBe('falling');
		expect(pressureTrend(3.6)).toBe('risingFast');
		expect(pressureTrend(-5)).toBe('fallingFast');
	});
});

describe('pressureAt', () => {
	const series = [1010, 1009.4, 1008.1, 1006.9, null];

	it('gives the change over the last three hours', () => {
		expect(pressureAt(series, 3)).toEqual({ hpa: 1006.9, change: -3.1 });
	});

	it('has no change before the third hour of the series', () => {
		expect(pressureAt(series, 2)).toEqual({ hpa: 1008.1, change: null });
	});

	it('has nothing where the value is missing', () => {
		expect(pressureAt(series, 4)).toBeNull();
		expect(pressureAt([], 0)).toBeNull();
	});
});
