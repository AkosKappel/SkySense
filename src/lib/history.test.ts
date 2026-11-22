import { describe, expect, it } from 'vitest';
import bratislavaNormals from '#lib/server/fixtures/normals-bratislava.json';
import bratislavaHistory from '#lib/server/fixtures/history-bratislava.json';
import { toHistory, toNormals } from '#lib/server/open-meteo.js';
import { againstNormal, periodOf, records, step, type DayNormal } from './history.js';

describe('periodOf', () => {
	it('finds the day, the Monday to Sunday week, the month and the year', () => {
		expect(periodOf('day', '2023-11-14')).toEqual({ from: '2023-11-14', to: '2023-11-14' });
		expect(periodOf('week', '2023-11-14')).toEqual({ from: '2023-11-13', to: '2023-11-19' });
		expect(periodOf('week', '2023-11-19')).toEqual({ from: '2023-11-13', to: '2023-11-19' });
		expect(periodOf('month', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
		expect(periodOf('year', '2023-11-14')).toEqual({ from: '2023-01-01', to: '2023-12-31' });
	});
});

describe('step', () => {
	it('moves to the start of the period before or after', () => {
		expect(step('day', '2024-03-01', -1)).toBe('2024-02-29');
		expect(step('week', '2023-11-14', 1)).toBe('2023-11-20');
		expect(step('month', '2023-01-31', -1)).toBe('2022-12-01');
		expect(step('year', '2023-06-15', 1)).toBe('2024-01-01');
	});
});

describe('againstNormal', () => {
	const normals: DayNormal[] = [
		{ day: '11-01', max: 10, min: 2, rain: 2 },
		{ day: '11-02', max: 10, min: 2, rain: 2 },
		{ day: '12-01', max: 4, min: -2, rain: 1 }
	];

	it('compares the mean temperature and the rain with the normal', () => {
		const result = againstNormal(
			[
				{ date: '2023-11-01', max: 13, min: 5, rain: 10, gust: 40 },
				{ date: '2023-11-02', max: 12, min: 4, rain: 0.5, gust: 30 }
			],
			normals,
			'month'
		)!;
		expect(result.diff).toBe(2.5);
		expect(result.warmth).toBe('warmer');
		expect(result).toMatchObject({ rain: 10.5, normalRain: 4, wetness: 'wetter' });
		expect(result.buckets.map((b) => b.key)).toEqual(['2023-11-01', '2023-11-02']);
	});

	it('groups a year by month and calls small differences usual', () => {
		const result = againstNormal(
			[
				{ date: '2023-11-01', max: 10.2, min: 2, rain: 2.5, gust: 0 },
				{ date: '2023-12-01', max: 4, min: -2, rain: 0.5, gust: 0 }
			],
			normals,
			'year'
		)!;
		expect(result.warmth).toBe('usual');
		// Half a millimetre less than a usual 3 mm is a quarter less, but not drier.
		expect(result.wetness).toBe('usual');
		expect(result.buckets.map((b) => b.key)).toEqual(['2023-11', '2023-12']);
	});

	it('says nothing without days that have a normal', () => {
		expect(againstNormal([], normals, 'day')).toBeNull();
	});
});

describe('toNormals', () => {
	it('gives every calendar day a normal, winter colder than summer', () => {
		const normals = toNormals(bratislavaNormals);
		expect(normals).toHaveLength(366);
		const of = (day: string) => normals.find((n) => n.day === day)!;
		expect({ ...of('02-29'), day: '03-01' }).toEqual(of('03-01'));
		expect(of('07-20').max).toBeGreaterThan(of('01-20').max + 15);
		expect(of('01-20').min).toBeLessThan(of('01-20').max);
	});
});

describe('records', () => {
	it('finds the warmest day, coldest night, wettest day and strongest gust', () => {
		expect(
			records([
				{ date: '2026-01-10', max: -2, min: -9, rain: 0, gust: 40 },
				{ date: '2026-07-20', max: 34, min: 20, rain: 0.5, gust: 30 },
				{ date: '2026-07-21', max: 28, min: 18, rain: 22, gust: 75 }
			])
		).toEqual({
			warmest: { date: '2026-07-20', value: 34 },
			coldest: { date: '2026-01-10', value: -9 },
			wettest: { date: '2026-07-21', value: 22 },
			windiest: { date: '2026-07-21', value: 75 }
		});
		expect(records([])).toBeNull();
	});

	it('reads a recorded year: summer warmest, winter coldest', () => {
		const year = records(toHistory(bratislavaHistory).filter((d) => d.date.startsWith('2025')))!;
		expect(['06', '07', '08']).toContain(year.warmest.date.slice(5, 7));
		expect(['12', '01', '02']).toContain(year.coldest.date.slice(5, 7));
	});
});
