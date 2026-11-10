import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import bratislavaAir from '#lib/server/fixtures/air-bratislava.json';
import { toAir, toForecast, withAir } from '#lib/server/open-meteo.js';
import { airLevel, airSummary } from './air.js';
import type { Hour } from './weather.js';

const hour = (i: number, extra: Partial<Hour>): Hour => ({
	time: `2026-11-10T${String(i).padStart(2, '0')}:00`,
	temp: 10,
	feels: 10,
	condition: 'clear',
	isDay: true,
	rainChance: 0,
	rain: 0,
	wind: 5,
	gust: 10,
	uv: 1,
	...extra
});

describe('air', () => {
	it('follows the European AQI bands', () => {
		expect([10, 30, 50, 70, 90, 120].map(airLevel)).toEqual([
			'good',
			'fair',
			'moderate',
			'poor',
			'veryPoor',
			'extreme'
		]);
	});

	it('says nothing when the air is fair and there is little pollen', () => {
		expect(airSummary([hour(8, { aqi: 25, pollen: { kind: 'birch', grains: 5 } })])).toEqual({
			air: null,
			pollen: null
		});
		expect(airSummary([hour(8, {})])).toEqual({ air: null, pollen: null });
	});

	it('names the worst hour and the strongest pollen', () => {
		const summary = airSummary([
			hour(8, { aqi: 45 }),
			hour(9, { aqi: 72, pollen: { kind: 'grass', grains: 20 } }),
			hour(10, { aqi: 50, pollen: { kind: 'birch', grains: 80 } })
		]);
		expect(summary).toEqual({
			air: { aqi: 72, time: '2026-11-10T09:00', level: 'poor' },
			pollen: { kind: 'birch', level: 'high' }
		});
	});

	it('reads a recorded forecast', () => {
		const forecast = withAir(toForecast(bratislava), toAir(bratislavaAir));
		expect(airSummary(forecast.hours.slice(0, 24)).air?.level).toBe('moderate');
	});
});
