import { describe, expect, it } from 'vitest';
import { toClimate } from '#lib/server/open-meteo.js';
import { compareToNormal, forDate, percentBelow, type Normal } from './climate.js';

const deciles = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const normal: Normal = { date: '2026-11-10', max: deciles.map((d) => d + 5), min: deciles };

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
