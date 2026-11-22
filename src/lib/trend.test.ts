import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/record-bratislava.json';
import { toRecord } from '#lib/server/open-meteo.js';
import { era5Cell, lastWholeYear, summarizeRecord, trendOf, type YearStats } from './trend.js';

describe('summarizeRecord', () => {
	it('sums each year and month', () => {
		const { years, months } = summarizeRecord([
			{ date: '1961-01-01', max: -1, min: -5, rain: 2 },
			{ date: '1961-07-01', max: 31, min: 18, rain: 0.5 },
			{ date: '1962-07-01', max: 25, min: 15, rain: 0 }
		]);
		expect(years[0]).toEqual({ year: 1961, mean: 10.8, hot: 1, frost: 1, rain: 3, rainDays: 1 });
		expect(months.map((m) => m.month)).toEqual(['1961-01', '1961-07', '1962-07']);
	});
});

describe('trendOf', () => {
	// 1961 to 2025, a steady 0.03° a year warmer, so 2016 to 2025 sit about 1.4° above 1961 to 1990.
	const years: YearStats[] = Array.from({ length: 65 }, (_, i) => ({
		year: 1961 + i,
		mean: 10 + i * 0.03,
		hot: i < 30 ? 2 : 8,
		frost: 90,
		rain: 600,
		rainDays: 100
	}));
	const months = years.map((y) => ({ month: `${y.year}-11`, mean: y.mean - 5 }));

	it('compares the last ten years with 1961 to 1990, by decade and for one month', () => {
		const trend = trendOf({ normals: [], years, months }, 11)!;
		expect(trend.warming).toBe(1.4);
		expect(trend.stripes[0].anomaly).toBe(-0.4);
		expect(trend.monthPerDecade).toBe(0.3);
		expect(trend.decades.map((d) => d.decade)).toEqual([1960, 1970, 1980, 1990, 2000, 2010, 2020]);
		expect(trend.decades.at(-1)).toMatchObject({ decade: 2020, to: 2025, hot: 8 });
		expect(trendOf({ normals: [], years, months }, 6)!.monthPerDecade).toBeNull();
	});

	it('says nothing about a record too short to show change', () => {
		expect(trendOf({ normals: [], years: years.slice(20), months }, 11)).toBeNull();
	});

	it('reads the recorded record: Bratislava has warmed', () => {
		const trend = trendOf(toRecord(bratislava), 11)!;
		expect(trend.firstYear).toBe(1961);
		expect(trend.lastYear).toBe(2025);
		expect(trend.warming).toBeGreaterThan(0.5);
	});
});

describe('era5Cell and lastWholeYear', () => {
	it('snap to the 0.25° grid and wait ten days into a year', () => {
		expect(era5Cell({ lat: 48.15, lon: 17.11 })).toEqual({ lat: 48.25, lon: 17 });
		expect(lastWholeYear('2026-01-05')).toBe(2024);
		expect(lastWholeYear('2026-01-11')).toBe(2025);
	});
});
