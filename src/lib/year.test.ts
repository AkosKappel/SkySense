import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/year-bratislava.json';
import { toYear } from '#lib/server/open-meteo.js';
import { summarizeYear } from './year.js';

describe('summarizeYear', () => {
	it('finds the records and counts rain days from 1 mm', () => {
		const year = summarizeYear([
			{ date: '2026-01-10', max: -2, min: -9, rain: 0, gust: 40 },
			{ date: '2026-07-20', max: 34, min: 20, rain: 0.5, gust: 30 },
			{ date: '2026-07-21', max: 28, min: 18, rain: 22, gust: 75 }
		])!;
		expect(year.warmest).toEqual({ date: '2026-07-20', value: 34 });
		expect(year.coldest).toEqual({ date: '2026-01-10', value: -9 });
		expect(year.wettest).toEqual({ date: '2026-07-21', value: 22 });
		expect(year.windiest).toEqual({ date: '2026-07-21', value: 75 });
		expect(year.rainDays).toBe(1);
		expect(year.months).toEqual([
			{ month: '2026-01', meanMax: -2, rain: 0, rainDays: 0 },
			{ month: '2026-07', meanMax: 31, rain: 22.5, rainDays: 1 }
		]);
	});

	it('says nothing for no days', () => {
		expect(summarizeYear([])).toBeNull();
	});

	it('reads a recorded year: twelve months, summer warmest, winter coldest', () => {
		const year = toYear(bratislava)!;
		expect(year.from).toBe('2025-11-01');
		expect(year.until).toBe('2026-10-31');
		expect(year.months).toHaveLength(12);
		expect(['06', '07', '08']).toContain(year.warmest.date.slice(5, 7));
		expect(['12', '01', '02']).toContain(year.coldest.date.slice(5, 7));
		expect(year.rainDays).toBeGreaterThan(30);
	});
});
