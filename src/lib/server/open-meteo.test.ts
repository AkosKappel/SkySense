import { describe, expect, it, vi } from 'vitest';
import bratislava from './fixtures/forecast-bratislava.json';
import places from './fixtures/places-bratisl.json';
import tromso from './fixtures/forecast-tromso.json';
import {
	fetchForecast,
	searchPlaces,
	toForecast,
	toPlaces,
	WeatherServiceError
} from './open-meteo.js';

describe('toForecast', () => {
	const forecast = toForecast(bratislava);

	it('starts the hours at the current hour', () => {
		expect(forecast.current.time).toBe('2026-11-10T10:00');
		expect(forecast.hours[0].time).toBe('2026-11-10T10:00');
		expect(forecast.hours).toHaveLength(48);
	});

	it('keeps ten days with sunrise and sunset', () => {
		expect(forecast.days).toHaveLength(10);
		expect(forecast.days[0]).toMatchObject({
			date: '2026-11-10',
			sunrise: '2026-11-10T06:50'
		});
	});

	it('maps weather codes and day flags', () => {
		expect(forecast.current.condition).toBe('rain');
		expect(typeof forecast.hours[0].isDay).toBe('boolean');
	});

	it('works for a place far north', () => {
		expect(toForecast(tromso).days[0].sunset).toBe('2026-11-10T13:58');
	});

	it('refuses a response of the wrong shape', () => {
		expect(() => toForecast({ hourly: {} })).toThrow(WeatherServiceError);
	});

	it('treats missing sunrise and sunset as null', () => {
		const polar = structuredClone(tromso);
		polar.daily.sunrise[0] = null as unknown as string;
		polar.daily.sunset[0] = null as unknown as string;
		expect(toForecast(polar).days[0]).toMatchObject({ sunrise: null, sunset: null });
	});
});

describe('toPlaces', () => {
	it('names the region and country, without repeating the name', () => {
		const [first] = toPlaces(places);
		expect(first).toEqual({
			id: 3060972,
			name: 'Bratislava',
			detail: 'Bratislavský, Slovensko',
			lat: 48.14816,
			lon: 17.10674
		});
	});

	it('returns no places when there are no results', () => {
		expect(toPlaces({})).toEqual([]);
	});
});

describe('requests', () => {
	it('asks Open-Meteo for rounded coordinates', async () => {
		const fetchFn = vi.fn(async () => Response.json(bratislava));
		await fetchForecast({ lat: 48.151321, lon: 17.098441 }, fetchFn);
		const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
		expect(url.searchParams.get('latitude')).toBe('48.15');
		expect(url.searchParams.get('longitude')).toBe('17.1');
		expect(url.searchParams.get('timezone')).toBe('auto');
	});

	it('turns an error status into a WeatherServiceError', async () => {
		const fetchFn = vi.fn(async () => new Response('busy', { status: 503 }));
		await expect(fetchForecast({ lat: 1, lon: 1 }, fetchFn)).rejects.toThrow(WeatherServiceError);
	});

	it('turns a network failure into a WeatherServiceError', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(searchPlaces('Bratislava', 'sk', fetchFn)).rejects.toThrow(WeatherServiceError);
	});

	it('searches in the reader’s language', async () => {
		const fetchFn = vi.fn(async () => Response.json(places));
		await searchPlaces('Bratisl', 'hu', fetchFn);
		const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
		expect(url.searchParams.get('language')).toBe('hu');
	});
});
