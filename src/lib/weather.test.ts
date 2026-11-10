import { describe, expect, it } from 'vitest';
import {
	conditionOf,
	formatCoordinates,
	nextRain,
	parseCoordinates,
	type Condition,
	type Hour
} from './weather.js';

const hour = (time: string, rainChance: number): Hour => ({
	time,
	temp: 10,
	feels: 9,
	condition: 'cloudy',
	isDay: true,
	rainChance,
	rain: 0,
	wind: 10,
	gust: 15,
	uv: 1
});

const day = (chances: number[], conditions: Condition[] = []) =>
	chances.map((chance, i) => ({
		...hour(`2026-11-10T${String(8 + i).padStart(2, '0')}:00`, chance),
		condition: conditions[i] ?? 'rain'
	}));

describe('conditionOf', () => {
	it.each([
		[0, 'clear'],
		[2, 'partly'],
		[3, 'cloudy'],
		[45, 'fog'],
		[53, 'drizzle'],
		[63, 'rain'],
		[81, 'showers'],
		[75, 'snow'],
		[86, 'snow'],
		[95, 'thunder']
	])('reads WMO code %i as %s', (code, condition) => {
		expect(conditionOf(code)).toBe(condition);
	});
});

describe('nextRain', () => {
	it('finds the first stretch of likely rain', () => {
		expect(nextRain(day([10, 20, 60, 80, 40, 70]))).toEqual({
			from: '2026-11-10T10:00',
			until: '2026-11-10T12:00',
			startsNow: false,
			openEnded: false,
			kind: 'rain'
		});
	});

	it('says when rain that is falling now stops', () => {
		expect(nextRain(day([90, 55, 10]))).toEqual({
			from: '2026-11-10T08:00',
			until: '2026-11-10T10:00',
			startsNow: true,
			openEnded: false,
			kind: 'rain'
		});
	});

	it('marks rain that is still falling at the end of the hours looked at', () => {
		expect(nextRain(day([10, 70]))).toMatchObject({ until: '2026-11-10T10:00', openEnded: true });
		expect(nextRain(day([10, 70, 70, 10]), 3)?.openEnded).toBe(true);
	});

	it.each([
		[['snow', 'snow'], 'snow'],
		[['rain', 'snow'], 'mixed'],
		[['drizzle', 'snow'], 'mixed'],
		[['showers', 'thunder'], 'thunder'],
		[['snow', 'thunder'], 'thunder'],
		[['cloudy', 'rain'], 'rain']
	] as [Condition[], string][])('calls %j %s', (conditions, kind) => {
		expect(nextRain(day([80, 80], conditions))?.kind).toBe(kind);
	});

	it('returns null when no hour reaches the threshold', () => {
		expect(nextRain(day([49, 30, 0]))).toBeNull();
	});

	it('only looks ahead the given number of hours', () => {
		expect(nextRain(day([0, 0, 0, 90]), 3)).toBeNull();
	});
});

describe('coordinates', () => {
	it('parses and rounds a place URL segment', () => {
		expect(parseCoordinates('48.15132,17.09844')).toEqual({ lat: 48.15, lon: 17.1 });
		expect(parseCoordinates('-33.87,151.21')).toEqual({ lat: -33.87, lon: 151.21 });
	});

	it.each(['', 'abc', '91,10', '10,181', '48.1;17.1', '48.1,17.1,3'])('refuses %j', (value) => {
		expect(parseCoordinates(value)).toBeNull();
	});

	it('formats rounded coordinates', () => {
		expect(formatCoordinates({ lat: 69.6496, lon: 18.9553 })).toBe('69.65,18.96');
	});
});
