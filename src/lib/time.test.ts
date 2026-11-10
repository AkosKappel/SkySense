import { describe, expect, it } from 'vitest';
import { darkness } from './daylight.js';
import {
	formatHour,
	formatMonth,
	formatPastDate,
	formatTime,
	formatWeekday,
	hoursAhead,
	intlLocale
} from './time.js';
import type { Day, Hour } from './weather.js';

describe('local times', () => {
	it('shows the place’s wall-clock time whatever the reader’s zone', () => {
		expect(formatTime('2026-11-10T16:22', 'en-GB', '24')).toBe('16:22');
		expect(formatTime('2026-11-10T16:22', 'en-US', '12')).toBe('4:22 PM');
		expect(formatTime('2026-11-10T00:05', 'de', '24')).toBe('00:05');
	});

	it('shows hours and weekdays in the language', () => {
		expect(formatHour('2026-11-10T09:00', 'hu', '24')).toBe('09');
		expect(formatWeekday('2026-11-10', 'de')).toMatch(/^Di/);
		expect(formatWeekday('2026-11-10', 'sk')).toBe('ut');
	});

	it('picks British or US English by clock', () => {
		expect(intlLocale('en', '24')).toBe('en-GB');
		expect(intlLocale('en', '12')).toBe('en-US');
		expect(intlLocale('sk', '12')).toBe('sk');
	});
});

describe('darkness', () => {
	const today: Day = {
		date: '2026-11-10',
		condition: 'clear',
		max: 10,
		min: 2,
		rainChance: 0,
		rain: 0,
		sunrise: '2026-11-10T06:50',
		sunset: '2026-11-10T16:22',
		uvMax: 1
	};
	const tomorrow: Day = { ...today, date: '2026-11-11', sunrise: '2026-11-11T06:52' };
	const hours = (isDay: boolean): Hour[] => [
		{
			time: '2026-11-10T12:00',
			temp: 0,
			feels: 0,
			condition: 'clear',
			isDay,
			rainChance: 0,
			rain: 0,
			wind: 0,
			gust: 0,
			uv: 0
		}
	];

	it('tells when the sun sets during the day', () => {
		expect(darkness('2026-11-10T10:00', today, tomorrow, [])).toEqual({
			kind: 'sets',
			at: '2026-11-10T16:22'
		});
	});

	it('gives tomorrow’s sunrise after sunset', () => {
		expect(darkness('2026-11-10T20:00', today, tomorrow, [])).toEqual({
			kind: 'dark',
			sunrise: '2026-11-11T06:52'
		});
	});

	it('gives today’s sunrise before dawn', () => {
		expect(darkness('2026-11-10T05:00', today, tomorrow, [])).toEqual({
			kind: 'dark',
			sunrise: '2026-11-10T06:50'
		});
	});

	it('tells polar night from midnight sun', () => {
		const noSun = { ...today, sunrise: null, sunset: null };
		expect(darkness('2026-11-10T12:00', noSun, tomorrow, hours(false))).toEqual({
			kind: 'polar-night'
		});
		expect(darkness('2026-11-10T12:00', noSun, tomorrow, hours(true))).toEqual({
			kind: 'midnight-sun'
		});
	});
});

describe('hoursAhead', () => {
	it('compares the place with the reader, in hours', () => {
		// Singapore (UTC+8) read in Bratislava in winter (UTC+1).
		expect(hoursAhead(8 * 3600, 60)).toBe(7);
		expect(hoursAhead(-5 * 3600, 60)).toBe(-6);
		expect(hoursAhead(19800, 0)).toBe(5.5);
		expect(hoursAhead(3600, 60)).toBe(0);
	});
});

describe('past dates and months', () => {
	it('names the year for past dates and can leave it off months', () => {
		expect(formatPastDate('2025-07-20', 'en-GB')).toBe('20 July 2025');
		expect(formatPastDate('2025-07-20', 'de')).toBe('20. Juli 2025');
		expect(formatMonth('2025-07', 'en-GB')).toBe('Jul');
		expect(formatMonth('2025-12', 'en-GB', true)).toBe('Dec 2025');
	});
});
