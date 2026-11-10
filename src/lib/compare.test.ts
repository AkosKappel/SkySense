import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import madrid from '#lib/server/fixtures/forecast-madrid.json';
import { toForecast } from '#lib/server/open-meteo.js';
import { compareDays } from './compare.js';

describe('compareDays', () => {
	const a = toForecast(bratislava);
	const b = toForecast(madrid);

	it('lines up the days both places have', () => {
		const days = compareDays(a, b);
		expect(days).toHaveLength(10);
		expect(days[0].date).toBe('2026-11-10');
		expect(days.every((d) => d.a.date === d.b.date)).toBe(true);
	});

	it('calls a place the same as itself a draw every day', () => {
		expect(compareDays(a, a).every((d) => d.better === null)).toBe(true);
	});

	it('marks the drier, milder place as better', () => {
		const wet = { ...a, hours: a.hours.map((h) => ({ ...h, rainChance: 95 })) };
		const days = compareDays(a, wet);
		expect(days.some((d) => d.better === 'a')).toBe(true);
		expect(days.some((d) => d.better === 'b')).toBe(false);
	});
});
