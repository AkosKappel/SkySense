import { describe, expect, it } from 'vitest';
import { commuteCheck, readCommute, writeCommute } from './commute.js';
import type { Hour } from './weather.js';

// Tuesday 10 November 2026, two days of hours, rain likely from 17:00 to 19:00 each day.
const hours: Hour[] = Array.from({ length: 48 }, (_, i) => {
	const date = i < 24 ? '2026-11-10' : '2026-11-11';
	const hour = i % 24;
	return {
		time: `${date}T${String(hour).padStart(2, '0')}:00`,
		temp: 10,
		feels: 10,
		condition: 'cloudy',
		isDay: hour >= 7 && hour < 17,
		rainChance: hour >= 17 && hour < 19 ? 80 : 10,
		rain: 0,
		wind: 10,
		gust: 15,
		uv: 1
	};
});
const both = { leave: '07:30', back: '17:30' };

describe('commute cookie', () => {
	it('reads one or both times and ignores anything else', () => {
		expect(readCommute('07:30-17:30')).toEqual(both);
		expect(readCommute('-17:30')).toEqual({ leave: null, back: '17:30' });
		expect(readCommute('25:00-x')).toBeNull();
		expect(readCommute(undefined)).toBeNull();
		expect(writeCommute('07:30', '')).toBe('07:30-');
		expect(writeCommute('7.30', null)).toBe('-');
	});
});

describe('commuteCheck', () => {
	it('checks the trips still ahead today', () => {
		expect(commuteCheck(hours, '2026-11-10T06:10', both)).toEqual({
			day: 'today',
			trips: [
				{ at: '2026-11-10T07:30', wet: false },
				{ at: '2026-11-10T17:30', wet: true }
			]
		});
		expect(commuteCheck(hours, '2026-11-10T12:00', both)?.trips).toEqual([
			{ at: '2026-11-10T17:30', wet: true }
		]);
	});

	it('moves to tomorrow once today’s trips are past', () => {
		expect(commuteCheck(hours, '2026-11-10T20:00', both)).toMatchObject({
			day: 'tomorrow',
			trips: [{ at: '2026-11-11T07:30' }, { at: '2026-11-11T17:30' }]
		});
	});

	it('says nothing at weekends or without a commute', () => {
		const friday = hours.map((h) => ({ ...h, time: h.time.replace('11-10', '11-13') }));
		expect(commuteCheck(friday, '2026-11-13T20:00', both)).toBeNull();
		expect(commuteCheck(hours, '2026-11-10T06:00', null)).toBeNull();
	});
});
