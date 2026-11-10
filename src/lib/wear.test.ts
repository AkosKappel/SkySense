import { describe, expect, it } from 'vitest';
import type { Hour } from './weather.js';
import { whatToWear } from './wear.js';

const hour = (h: number, extra: Partial<Hour> = {}): Hour => ({
	time: `2026-11-10T${String(h).padStart(2, '0')}:00`,
	temp: 12,
	feels: 12,
	condition: 'cloudy',
	isDay: true,
	rainChance: 0,
	rain: 0,
	wind: 10,
	gust: 15,
	uv: 2,
	...extra
});
const from = (start: number, extra: (h: number) => Partial<Hour> = () => ({})) =>
	Array.from({ length: 12 }, (_, i) => hour((start + i) % 24, extra((start + i) % 24)));

describe('whatToWear', () => {
	it('dresses for the coldest waking hour ahead', () => {
		expect(whatToWear(from(8))?.layer).toBe('light');
		expect(whatToWear(from(8, (h) => ({ feels: h === 18 ? 2 : 12 })))?.layer).toBe('winter');
		expect(whatToWear(from(8, () => ({ feels: 27 })))?.layer).toBe('tshirt');
		expect(whatToWear(from(8, () => ({ feels: -12 })))?.layer).toBe('arctic');
	});

	it('ignores the small hours unless they are all there is', () => {
		// From 20:00: 03:00 at -2 feels like does not count, 20:00 to 22:00 and 06:00 on do.
		expect(whatToWear(from(20, (h) => ({ feels: h >= 23 || h < 6 ? -2 : 12 })))?.layer).toBe(
			'light'
		);
	});

	it('moves the thresholds with the comfort profile', () => {
		const mild = from(8, () => ({ feels: 18 }));
		expect(whatToWear(mild)?.layer).toBe('layer');
		expect(whatToWear(mild, 3)?.layer).toBe('light');
		expect(whatToWear(mild, -3)?.layer).toBe('layer');
	});

	it('adds rain, wind and sun when they matter', () => {
		const day = from(8, (h) => ({
			rainChance: h === 14 ? 70 : 0,
			gust: h === 15 ? 65 : 15,
			uv: 7
		}));
		expect(whatToWear(day)?.extras).toEqual(['rain', 'wind', 'sun']);
		expect(whatToWear(from(8))?.extras).toEqual([]);
	});
});
