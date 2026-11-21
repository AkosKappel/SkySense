import { describe, expect, it } from 'vitest';
import { strongestGust, sunHours } from './charts.js';
import type { Hour } from './weather.js';

const hour = (i: number, over: Partial<Hour> = {}): Hour => ({
	time: `2026-11-10T${String(i).padStart(2, '0')}:00`,
	temp: 5,
	feels: 3,
	condition: 'cloudy',
	isDay: i >= 7 && i <= 16,
	rainChance: 0,
	rain: 0,
	wind: 10,
	gust: 20,
	uv: 0,
	...over
});

describe('strongestGust', () => {
	it('finds the first hour with the strongest gust', () => {
		const hours = [hour(0), hour(1, { gust: 45 }), hour(2, { gust: 45 }), hour(3)];
		expect(strongestGust(hours)?.time).toBe('2026-11-10T01:00');
		expect(strongestGust([])).toBeNull();
	});
});

describe('sunHours', () => {
	it('keeps the daylight hours and the UV peak', () => {
		const hours = Array.from({ length: 24 }, (_, i) =>
			hour(i, { uv: i === 12 ? 3.2 : i > 8 && i < 15 ? 1 : 0 })
		);
		const sun = sunHours(hours)!;
		expect(sun.hours).toHaveLength(10);
		expect(sun.peak.time).toBe('2026-11-10T12:00');
	});

	it('says nothing when the sun stays too low', () => {
		expect(sunHours(Array.from({ length: 24 }, (_, i) => hour(i, { uv: 0.45 })))).toBeNull();
		expect(sunHours([hour(0), hour(23)])).toBeNull();
	});
});
