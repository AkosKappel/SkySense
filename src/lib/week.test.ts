import { describe, expect, it } from 'vitest';
import type { Day, Hour } from '#lib/weather.js';
import { barHeight, bestDays, weekRows } from './week.js';

const day = (date: string): Day => ({
	date,
	condition: 'partly',
	max: 14,
	min: 6,
	rainChance: 0,
	rain: 0,
	sunrise: `${date}T06:55`,
	sunset: `${date}T16:15`,
	uvMax: 1
});
const hoursOf = (date: string, from: number, rainChance: number): Hour[] =>
	Array.from({ length: 24 - from }, (_, i) => ({
		time: `${date}T${String(from + i).padStart(2, '0')}:00`,
		temp: 12,
		feels: 12,
		condition: rainChance > 50 ? 'rain' : 'partly',
		isDay: from + i >= 7 && from + i < 16,
		rainChance,
		rain: rainChance > 50 ? 2 : 0,
		wind: 5,
		gust: 10,
		uv: 1
	}));
const days = [day('2026-11-13'), day('2026-11-14')];
// Today from 10:00 and wet; tomorrow whole and dry.
const hours = [...hoursOf('2026-11-13', 10, 90), ...hoursOf('2026-11-14', 0, 0)];

describe('weekRows', () => {
	it('lines every day up from midnight, leaving the hours gone by empty', () => {
		const [today, tomorrow] = weekRows(days, hours, ['run']);
		expect(today.hours).toHaveLength(24);
		expect(today.hours[9]).toBeNull();
		expect(today.hours[10]?.time).toBe('2026-11-13T10:00');
		expect(tomorrow.hours.every(Boolean)).toBe(true);
	});

	it('gives each day its own best window, only where there is one', () => {
		const [today, tomorrow] = weekRows(days, hours, ['run']);
		expect(today.windows).toEqual([]);
		expect(tomorrow.windows[0].id).toBe('run');
		expect(tomorrow.windows[0].window.from.startsWith('2026-11-14')).toBe(true);
	});
});

describe('bestDays', () => {
	it('picks the dry day for each chosen activity', () => {
		const [run] = bestDays(days, hours, ['run']);
		expect(run.window?.from.startsWith('2026-11-14')).toBe(true);
	});
});

describe('barHeight', () => {
	it('runs from a sliver at the lowest to full at the highest', () => {
		expect(barHeight(-2, -2, 10)).toBeCloseTo(0.15);
		expect(barHeight(10, -2, 10)).toBe(1);
		expect(barHeight(5, 5, 5)).toBeCloseTo(0.15);
	});
});
