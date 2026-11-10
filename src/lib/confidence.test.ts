import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import bratislavaEnsemble from '#lib/server/fixtures/ensemble-bratislava.json';
import singapore from '#lib/server/fixtures/forecast-singapore.json';
import singaporeEnsemble from '#lib/server/fixtures/ensemble-singapore.json';
import { toForecast, toSpread, withSpread } from '#lib/server/open-meteo.js';
import { dayConfidence } from './confidence.js';
import type { Hour, Spread } from './weather.js';

const hours = (spread: Spread | undefined, n = 24): Hour[] =>
	Array.from({ length: n }, (_, i) => ({
		time: `2026-11-10T${String(i).padStart(2, '0')}:00`,
		temp: 10,
		feels: 10,
		condition: 'cloudy',
		isDay: true,
		rainChance: 0,
		rain: 0,
		wind: 5,
		gust: 10,
		uv: 1,
		spread
	}));

const byDay = (forecast: ReturnType<typeof toForecast>) =>
	forecast.days.map((d) => dayConfidence(forecast.hours.filter((h) => h.time.startsWith(d.date))));

describe('dayConfidence', () => {
	it('is high when the runs agree on temperature and rain', () => {
		expect(dayConfidence(hours({ low: 9, high: 11, rain: 0 }))).toBe('high');
		expect(dayConfidence(hours({ low: 9, high: 11, rain: 100 }))).toBe('high');
	});

	it('drops as the temperature range widens or rain is a coin toss', () => {
		expect(dayConfidence(hours({ low: 8, high: 12, rain: 0 }))).toBe('medium');
		expect(dayConfidence(hours({ low: 9, high: 11, rain: 35 }))).toBe('medium');
		expect(dayConfidence(hours({ low: 5, high: 12, rain: 0 }))).toBe('low');
		expect(dayConfidence(hours({ low: 9, high: 11, rain: 50 }))).toBe('low');
	});

	it('says nothing without ensemble data', () => {
		expect(dayConfidence(hours(undefined))).toBeNull();
		expect(dayConfidence([])).toBeNull();
	});

	it('is sure about the next days and less sure about the last in a recorded forecast', () => {
		const days = byDay(withSpread(toForecast(bratislava), toSpread(bratislavaEnsemble)));
		expect(days.slice(0, 3)).toEqual(['high', 'high', 'high']);
		expect(days.at(-1)).toBe('low');
	});

	it('keeps tropical showers from making every day uncertain', () => {
		const days = byDay(withSpread(toForecast(singapore), toSpread(singaporeEnsemble)));
		expect(days.filter((d) => d === 'high').length).toBeGreaterThan(5);
	});
});
