import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import { toForecast } from '#lib/server/open-meteo.js';
import { activities, band, bestWindow, comfortShift, scoreHour } from './activities.js';
import type { Day, Hour } from './weather.js';

const day: Day = {
	date: '2026-11-10',
	condition: 'clear',
	max: 15,
	min: 5,
	rainChance: 0,
	rain: 0,
	sunrise: '2026-11-10T06:50',
	sunset: '2026-11-10T16:19',
	uvMax: 2
};
const hour = (h: number, extra: Partial<Hour> = {}): Hour => ({
	time: `2026-11-10T${String(h).padStart(2, '0')}:00`,
	temp: 12,
	feels: 12,
	condition: 'clear',
	isDay: h >= 7 && h < 17,
	rainChance: 0,
	rain: 0,
	wind: 10,
	gust: 15,
	uv: 2,
	...extra
});
const hours = (extra: (h: number) => Partial<Hour> = () => ({})) =>
	Array.from({ length: 24 }, (_, h) => hour(h, extra(h)));
const score = (id: keyof typeof activities, list: Hour[], index: number) =>
	scoreHour(activities[id], { hours: list, index, days: [day], shift: 0 });

describe('band', () => {
	it('is 1 inside the ideal range and falls to 0 at the acceptable edge', () => {
		expect(band(10, [0, 30], [8, 18])).toBe(1);
		expect(band(4, [0, 30], [8, 18])).toBe(0.5);
		expect(band(24, [0, 30], [8, 18])).toBe(0.5);
		expect(band(-3, [0, 30], [8, 18])).toBe(0);
	});
});

describe('scoreHour', () => {
	it('scores a mild, dry, calm day hour as great for a run', () => {
		expect(score('run', hours(), 10)).toMatchObject({ score: 100, reason: null, gated: false });
	});

	it('names the main reason an hour is poor', () => {
		expect(
			score(
				'run',
				hours(() => ({ rainChance: 90 })),
				10
			)
		).toMatchObject({ reason: 'rain' });
		expect(
			score(
				'cycle',
				hours(() => ({ wind: 32, gust: 50 })),
				10
			).reason
		).toBe('wind');
		expect(
			score(
				'walk',
				hours(() => ({ feels: -6 })),
				10
			).reason
		).toBe('cold');
	});

	it('keeps laundry in when rain comes within the next hours', () => {
		const later = hours((h) => ({ rainChance: h === 13 ? 80 : 0, temp: 20 }));
		expect(score('laundry', later, 11).score).toBe(0);
		expect(score('laundry', later, 11).reason).toBe('rain');
		expect(score('laundry', later, 7).score).toBeGreaterThan(80);
	});

	it('wants a clear night for stars and a clear dawn or dusk for photos', () => {
		const list = hours((h) => ({ condition: h === 22 ? 'cloudy' : 'clear' }));
		expect(score('stars', list, 21).score).toBe(100);
		expect(score('stars', list, 22).reason).toBe('clouds');
		expect(score('stars', list, 12).reason).toBe('daylight');
		// Around the full moon of 24 November the sky is too bright for a great night.
		const fullMoon = list.map((h) => ({ ...h, time: h.time.replace('11-10', '11-24') }));
		expect(score('stars', fullMoon, 21).score).toBeLessThan(80);
		expect(score('stars', fullMoon, 21).score).toBeGreaterThanOrEqual(60);
		expect(score('stars', fullMoon, 21).reason).toBe('moon');
		expect(score('golden', list, 16).score).toBeGreaterThan(90);
		expect(score('golden', list, 12).reason).toBe('notGolden');
	});
});

describe('bestWindow', () => {
	it('finds the best stretch as long as the activity takes', () => {
		const list = hours((h) => ({
			rainChance: h >= 9 && h < 12 ? 0 : 90,
			feels: h === 11 ? 16 : 10
		}));
		expect(bestWindow(activities.cycle, list, [day]).window).toMatchObject({
			from: '2026-11-10T10:00',
			until: '2026-11-10T12:00'
		});
		expect(bestWindow(activities.laundry, list, [day]).window).toBeNull();
	});

	it('never suggests the middle of the night for a walk', () => {
		expect(score('walk', hours(), 3)).toMatchObject({ score: 0, gated: true });
	});

	it('explains with hours that meet the requirements', () => {
		const cloudyNights = hours((h) => ({ condition: h >= 17 || h < 7 ? 'cloudy' : 'clear' }));
		expect(bestWindow(activities.stars, cloudyNights, [day]).reason).toBe('clouds');
	});

	it('says why there is no window', () => {
		expect(
			bestWindow(
				activities.run,
				hours(() => ({ rainChance: 95 })),
				[day]
			)
		).toMatchObject({
			window: null,
			reason: 'rain'
		});
	});

	it('reads a recorded forecast', () => {
		const forecast = toForecast(bratislava);
		const run = bestWindow(activities.run, forecast.hours.slice(0, 24), forecast.days);
		expect(run.window?.from).toBeDefined();
		expect(run.window!.score).toBeGreaterThanOrEqual(60);
	});

	it('explains the window with the average of each factor', () => {
		const list = hours((h) => ({ wind: h === 11 ? 30 : 10, gust: 15 }));
		const { detail } = bestWindow(activities.cycle, list, [day]);
		expect(detail?.score).toBe(100);
		expect(detail?.factors.map((f) => f.id)).toEqual(['feels', 'rain', 'wind', 'light', 'uv']);
		expect(detail?.factors.every((f) => f.value === 1)).toBe(true);
	});

	it('explains a missing window with the best hour', () => {
		const { detail } = bestWindow(
			activities.run,
			hours((h) => ({ rainChance: h === 9 ? 60 : 95 })),
			[day]
		);
		expect(detail?.time).toBe('2026-11-10T09:00');
		expect(detail?.factors.find((f) => f.id === 'rain')!.value).toBeLessThan(1);
	});
});

describe('comfort profile', () => {
	it('moves the comfort range for someone who gets cold or warm easily', () => {
		const chilly = hours(() => ({ feels: 9 }));
		const at = (shift: number) =>
			scoreHour(activities.walk, { hours: chilly, index: 10, days: [day], shift });
		expect(at(comfortShift.neutral).score).toBe(at(comfortShift.warm).score);
		expect(at(comfortShift.cold).score).toBeLessThan(at(comfortShift.neutral).score);
		expect(at(comfortShift.cold).reason).toBe('cold');
	});
});
