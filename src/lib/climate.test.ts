import { describe, expect, it } from 'vitest';
import { toClimate } from '#lib/server/open-meteo.js';
import {
	compareToNormal,
	forDate,
	lastWeek,
	pastRecord,
	percentBelow,
	unusual,
	type Normal
} from './climate.js';

const deciles = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Highs 5° to 15°, lows 0° to 10°, rain up to 10 mm, the 90th percentile 9 mm.
const normal: Normal = {
	date: '2026-11-10',
	max: deciles.map((d) => d + 5),
	min: deciles,
	rain: deciles
};

describe('percentBelow', () => {
	it('interpolates between deciles and clamps at the ends', () => {
		expect(percentBelow(5, deciles)).toBe(50);
		expect(percentBelow(5.5, deciles)).toBe(55);
		expect(percentBelow(-3, deciles)).toBe(0);
		expect(percentBelow(30, deciles)).toBe(100);
	});
});

describe('compareToNormal', () => {
	it('calls a day warmer or colder from 1.5° off the median high', () => {
		expect(compareToNormal(14, normal)).toEqual({ kind: 'warmer', diff: 4, percent: 90 });
		expect(compareToNormal(8, normal)).toEqual({ kind: 'colder', diff: 2, percent: 30 });
		expect(compareToNormal(11, normal).kind).toBe('normal');
	});
});

describe('toClimate', () => {
	// Every 10 November from 1991 to 2025, the high one degree warmer each year.
	const years = Array.from({ length: 35 }, (_, i) => 1991 + i);
	const raw = {
		daily: {
			time: years.map((y) => `${y}-11-10`),
			temperature_2m_max: years.map((y) => y - 1990),
			temperature_2m_min: years.map(() => 0),
			precipitation_sum: years.map((y) => (y === 2024 ? 3 : 0))
		}
	};
	const climate = toClimate(raw, '2026-11');

	it('builds the normal from 1991 to 2020 only', () => {
		const { normal } = forDate(climate, '2026-11-10');
		expect(normal?.max[0]).toBe(1);
		expect(normal?.max[10]).toBe(30);
		expect(normal?.max[5]).toBe(15.5);
	});

	it('gives a normal to nearby days of the month, within a week', () => {
		expect(forDate(climate, '2026-11-17').normal).not.toBeNull();
		expect(forDate(climate, '2026-11-18').normal).toBeNull();
	});

	it('keeps the last ten years of the same date, newest first', () => {
		const { past } = forDate(climate, '2026-11-10');
		expect(past.map((d) => d.date.slice(0, 4))).toEqual([
			'2025',
			'2024',
			'2023',
			'2022',
			'2021',
			'2020',
			'2019',
			'2018',
			'2017',
			'2016'
		]);
		expect(past[1].rain).toBe(3);
	});
});

describe('pastRecord', () => {
	const past = [8, 11, 6, 9, 10].map((max, i) => ({
		date: `${2020 + i}-11-21`,
		max,
		min: 0,
		rain: 0
	}));

	it('names a high above or below every past year', () => {
		expect(pastRecord(12, past)).toBe('warmest');
		expect(pastRecord(5, past)).toBe('coldest');
		expect(pastRecord(11, past)).toBeNull();
	});

	it('needs at least five years', () => {
		expect(pastRecord(20, past.slice(1))).toBeNull();
	});
});

describe('unusual', () => {
	it('calls a day beyond the 10th or 90th percentile unusual, beyond them all rare', () => {
		expect(unusual({ max: 10, min: 5, rain: 0 }, normal)).toEqual({
			level: 'usual',
			standouts: []
		});
		expect(unusual({ max: 14.5, min: 5, rain: 0 }, normal)).toEqual({
			level: 'unusual',
			standouts: [{ measure: 'day', percent: 95 }]
		});
		expect(unusual({ max: 10, min: -1, rain: 12 }, normal)).toEqual({
			level: 'rare',
			standouts: [
				{ measure: 'night', percent: 0 },
				{ measure: 'rain', percent: 100 }
			]
		});
	});

	it('never calls a dry day unusual for its rain', () => {
		const dry = { ...normal, rain: [0, 0, 0, 0, 0, 0, 0, 1, 2, 5, 20] };
		expect(unusual({ max: 10, min: 5, rain: 0.5 }, dry).standouts).toEqual([]);
	});
});

describe('lastWeek', () => {
	const climate = {
		normals: Array.from({ length: 9 }, (_, i) => ({ ...normal, date: `2026-11-0${i + 1}` })),
		past: []
	};
	const day = (date: string, max: number) => ({ date, max, min: max - 10, rain: 0 });

	it('averages the 7 days before today against their median high and low', () => {
		// Normal mean (10 + 5) / 2 = 7.5; 2 to 8 November are (14 + 4) / 2 = 9. The cold 1 November
		// and today itself fall outside the week.
		const days = ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((d, i) =>
			day(`2026-11-${d}`, i === 0 || i === 8 ? 0 : 14)
		);
		expect(lastWeek(days, climate, '2026-11-09')).toBe(1.5);
	});

	it('says nothing when too few of the days have a normal', () => {
		const days = ['10-29', '10-30', '10-31', '11-01', '11-02'].map((d) => day(`2026-${d}`, 14));
		expect(lastWeek(days, climate, '2026-11-03')).toBeNull();
	});
});
