import { describe, expect, it } from 'vitest';
import { checkForecast, type HindcastDay } from './hindcast.js';

const day = (date: string, over: Partial<HindcastDay> = {}): HindcastDay => ({
	date,
	high: 10,
	forecastHigh: 10,
	rain: 0,
	forecastRain: 0,
	...over
});

const week = (last: Partial<HindcastDay> = {}) => [
	...['01', '02', '03', '04', '05', '06'].map((d) => day(`2026-11-${d}`)),
	day('2026-11-07', last)
];

describe('checkForecast', () => {
	it('says how far off the high was, positive when the forecast was too warm', () => {
		expect(checkForecast(week({ high: 8, forecastHigh: 10.04 }), '2026-11-08')?.highError).toBe(2);
		expect(checkForecast(week({ high: 12, forecastHigh: 10 }), '2026-11-08')?.highError).toBe(-2);
	});

	it('tells a missed rain from rain that never came, with 1 mm as a rain day', () => {
		const rain = (rain: number, forecastRain: number) =>
			checkForecast(week({ rain, forecastRain }), '2026-11-08')?.rain;
		expect(rain(4, 0.2)).toBe('missed');
		expect(rain(0.5, 3)).toBe('unexpected');
		expect(rain(1, 6)).toBe('right');
		expect(rain(0, 0.9)).toBe('right');
	});

	it('counts a day right when the high is within 2 degrees and the rain day matches', () => {
		const days = week({ high: 10, forecastHigh: 12 });
		days[0] = day('2026-11-01', { forecastHigh: 12.5 });
		days[1] = day('2026-11-02', { rain: 3 });
		expect(checkForecast(days, '2026-11-08')?.rate).toEqual({ hits: 5, days: 7 });
	});

	it('leaves out today and shows no rate for less than a week', () => {
		const days = [...week(), day('2026-11-08', { forecastHigh: 30 })];
		expect(checkForecast(days, '2026-11-08')?.rate).toEqual({ hits: 7, days: 7 });
		expect(checkForecast(days.slice(2), '2026-11-08')?.rate).toBeNull();
	});

	it('gives nothing without yesterday', () => {
		expect(checkForecast(week().slice(0, 6), '2026-11-08')).toBeNull();
	});
});
