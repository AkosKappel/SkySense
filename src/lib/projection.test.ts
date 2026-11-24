import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/projection-bratislava.json';
import { toProjection } from '#lib/server/open-meteo.js';
import { projectionOf } from './projection.js';

describe('projectionOf', () => {
	const flat = (value: number, days = 10) => Array<number | null>(days).fill(value);

	it('compares each model with its own past and reports the middle and the range', () => {
		const projection = projectionOf(
			{ a: flat(10), b: flat(12), c: flat(8), d: flat(11) },
			{ a: flat(11), b: flat(14), c: flat(9.5), d: flat(12.2) }
		);
		// Changes 1, 2, 1.5 and 1.2: the median of four is between 1.2 and 1.5.
		expect(projection).toEqual({ models: 4, median: 1.4, low: 1, high: 2 });
	});

	it('leaves out a model with too many gaps, and says nothing with fewer than three', () => {
		const gappy = [...flat(30, 7), null, null, null];
		expect(
			projectionOf({ a: flat(10), b: flat(10), c: gappy }, { a: flat(11), b: flat(11), c: flat(0) })
		).toBeNull();
		expect(
			projectionOf(
				{ a: flat(10), b: flat(10), c: flat(10) },
				{ a: flat(11), b: [...flat(12, 9), null], c: flat(13) }
			)?.median
		).toBe(2);
	});
});

describe('toProjection', () => {
	it('reads the recorded models for Bratislava: warmer, with a spread between them', () => {
		const projection = toProjection(bratislava.base, bratislava.future)!;
		expect(projection.models).toBe(7);
		expect(projection.median).toBeGreaterThan(0.5);
		expect(projection.median).toBeLessThan(3);
		expect(projection.low).toBeLessThan(projection.high);
	});
});
