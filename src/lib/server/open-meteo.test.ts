import { describe, expect, it, vi } from 'vitest';
import bratislava from './fixtures/forecast-bratislava.json';
import bratislavaEnsemble from './fixtures/ensemble-bratislava.json';
import bratislavaAir from './fixtures/air-bratislava.json';
import places from './fixtures/places-bratisl.json';
import tromso from './fixtures/forecast-tromso.json';
import areaBratislava from './fixtures/area-bratislava.json';
import heat from './fixtures/scenario-heat.json';
import reverseBratislava from './fixtures/reverse-bratislava.json';
import reverseTromso from './fixtures/reverse-tromso.json';
import midnightSun from './fixtures/scenario-midnight-sun.json';
import polarNight from './fixtures/scenario-polar-night.json';
import { darkness } from '../daylight.js';
import {
	fetchForecast,
	reverseGeocode,
	searchPlaces,
	toForecast,
	toPlaces,
	toAir,
	toArea,
	toAreaName,
	toSpread,
	WeatherServiceError,
	withSpread
} from './open-meteo.js';

/** Answers the forecast, ensemble and air quality requests separately, by host. */
const route = (
	forecast: () => Response,
	ensemble: () => Response = () => Response.json(bratislavaEnsemble),
	air: () => Response = () => Response.json(bratislavaAir)
) =>
	vi.fn<typeof fetch>(async (input) => {
		const host = new URL(String(input)).hostname;
		return host.startsWith('ensemble') ? ensemble() : host.startsWith('air') ? air() : forecast();
	});
const forecastCalls = (fetchFn: ReturnType<typeof route>) =>
	fetchFn.mock.calls.filter(([input]) => new URL(String(input)).hostname === 'api.open-meteo.com');

describe('toForecast', () => {
	const forecast = toForecast(bratislava);

	it('starts the hours at the current hour', () => {
		expect(forecast.current.time).toBe('2026-11-10T10:00');
		expect(forecast.hours[0].time).toBe('2026-11-10T10:00');
		expect(forecast.hours).toHaveLength(240 - 10);
		expect(forecast.hours.at(-1)?.time).toBe('2026-11-19T23:00');
	});

	it('reads the pressure now and its change over the last three hours', () => {
		expect(forecast.current.pressure).toEqual({ hpa: 1013.6, change: -1 });
	});

	it('leaves the pressure out when a recording has none', () => {
		const hourly = { ...bratislava.hourly, pressure_msl: undefined };
		expect(toForecast({ ...bratislava, hourly }).current.pressure).toBeNull();
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

	it('reads polar night from the recorded December forecast', () => {
		const f = toForecast(polarNight);
		expect(f.days[0]).toMatchObject({ sunrise: null, sunset: null });
		expect(darkness(f.current.time, f.days[0], f.days[1], f.hours)).toEqual({
			kind: 'polar-night'
		});
	});

	it('reads the midnight sun from the recorded June forecast', () => {
		const f = toForecast(midnightSun);
		expect(f.days[0]).toMatchObject({ sunrise: null, sunset: null });
		expect(darkness(f.current.time, f.days[0], f.days[1], f.hours)).toEqual({
			kind: 'midnight-sun'
		});
	});

	it('keeps ordinary sunrise and sunset in a heat wave', () => {
		const f = toForecast(heat);
		expect(f.days[0]).toMatchObject({ sunrise: '2026-07-10T05:53', sunset: '2026-07-10T20:46' });
		expect(f.days[0].max).toBeGreaterThan(30);
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

	it("moves the reader's country up and keeps the order otherwise", () => {
		const names = toPlaces(places, 'SI').map((p) => p.name);
		expect(names[0]).toBe('Bratislavci');
		expect(names.slice(1, 3)).toEqual(['Bratislava', 'Bratislava - Rača']);
	});

	it('returns no places when there are no results', () => {
		expect(toPlaces({})).toEqual([]);
	});
});

describe('toSpread', () => {
	const spread = toSpread(bratislavaEnsemble);

	it('reduces 51 members to a range and a rain share per hour', () => {
		const hour = spread['2026-11-10T12:00'];
		expect(Object.keys(spread)).toHaveLength(240);
		expect(hour.low).toBeLessThanOrEqual(hour.high);
		expect(hour.rain).toBeGreaterThanOrEqual(0);
		expect(hour.rain).toBeLessThanOrEqual(100);
	});

	it('takes percentiles and the share of wet members', () => {
		const members = Object.fromEntries(
			Array.from({ length: 10 }, (_, i) => [
				[i ? `temperature_2m_member0${i}` : 'temperature_2m', [i]],
				[i ? `precipitation_member0${i}` : 'precipitation', [i < 3 ? 1 : 0]]
			]).flat()
		);
		expect(toSpread({ hourly: { time: ['2026-11-10T00:00'], ...members } })).toEqual({
			'2026-11-10T00:00': { low: 0.9, high: 8.1, rain: 30 }
		});
	});

	it('skips hours with too few members', () => {
		expect(toSpread({ hourly: { time: ['t'], temperature_2m: [1], precipitation: [0] } })).toEqual(
			{}
		);
	});

	it('widens over the days', () => {
		const forecast = withSpread(toForecast(bratislava), spread);
		const width = (h: (typeof forecast.hours)[number]) => h.spread!.high - h.spread!.low;
		expect(width(forecast.hours.at(-1)!)).toBeGreaterThan(width(forecast.hours[0]));
	});
});

describe('toAir', () => {
	it('keeps the air quality index for every hour it covers', () => {
		const air = toAir(bratislavaAir);
		expect(Object.keys(air)).toHaveLength(120);
		expect(air['2026-11-10T12:00'].aqi).toBeGreaterThan(0);
	});

	it('picks the strongest pollen above zero', () => {
		const air = toAir({
			hourly: {
				time: ['t1', 't2'],
				european_aqi: [30, null],
				birch_pollen: [12, 0],
				grass_pollen: [40, 0],
				ragweed_pollen: [null, 0]
			}
		});
		expect(air).toEqual({ t1: { aqi: 30, pollen: { kind: 'grass', grains: 40 } } });
	});
});

describe('requests', () => {
	it('asks Open-Meteo for rounded coordinates', async () => {
		const fetchFn = route(() => Response.json(bratislava));
		await fetchForecast({ lat: 48.151321, lon: 17.098441 }, fetchFn);
		const url = new URL(String(forecastCalls(fetchFn)[0][0]));
		expect(url.searchParams.get('latitude')).toBe('48.15');
		expect(url.searchParams.get('longitude')).toBe('17.1');
		expect(url.searchParams.get('timezone')).toBe('auto');
	});

	it('retries a server error once and then gives up', async () => {
		const fetchFn = route(() => new Response('busy', { status: 503 }));
		await expect(fetchForecast({ lat: 1, lon: 1 }, fetchFn)).rejects.toThrow(WeatherServiceError);
		expect(forecastCalls(fetchFn)).toHaveLength(2);
	});

	it('recovers when the retry succeeds', async () => {
		const answers = [new Response('busy', { status: 502 }), Response.json(bratislava)];
		const fetchFn = route(() => answers.shift()!);
		const forecast = await fetchForecast({ lat: 48.15, lon: 17.11 }, fetchFn);
		expect(forecast.current.time).toBe('2026-11-10T10:00');
	});

	it('does not retry when the rate limit is hit', async () => {
		const fetchFn = route(() => new Response('slow down', { status: 429 }));
		await expect(fetchForecast({ lat: 1, lon: 1 }, fetchFn)).rejects.toThrow('answered 429');
		expect(forecastCalls(fetchFn)).toHaveLength(1);
	});

	it('asks for the ensemble alongside and adds its spread', async () => {
		const fetchFn = route(() => Response.json(bratislava));
		const forecast = await fetchForecast({ lat: 48.15, lon: 17.11 }, fetchFn);
		const ensemble = fetchFn.mock.calls.find(([input]) =>
			new URL(String(input)).hostname.startsWith('ensemble')
		);
		expect(new URL(String(ensemble![0])).searchParams.get('models')).toBe('ecmwf_ifs025_ensemble');
		expect(forecast.hours[0].spread).toBeDefined();
		expect(forecast.hours[0].aqi).toBeDefined();
	});

	it('still loads the forecast when the ensemble fails', async () => {
		const fetchFn = route(
			() => Response.json(bratislava),
			() => new Response('down', { status: 404 })
		);
		const forecast = await fetchForecast({ lat: 48.15, lon: 17.11 }, fetchFn);
		expect(forecast.hours[0].spread).toBeUndefined();
	});

	it('turns a network failure into a WeatherServiceError after one retry', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});
		await expect(searchPlaces('Bratislava', 'sk', undefined, fetchFn)).rejects.toThrow(
			WeatherServiceError
		);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it('searches in the reader’s language', async () => {
		const fetchFn = vi.fn(async () => Response.json(places));
		await searchPlaces('Bratisl', 'hu', undefined, fetchFn);
		const url = new URL(String((fetchFn.mock.calls[0] as unknown[])[0]));
		expect(url.searchParams.get('language')).toBe('hu');
	});
});

describe('reverse geocoding', () => {
	it('names the city rather than its district, and the municipality where there is no city', () => {
		expect(toAreaName(reverseBratislava)).toBe('Bratislava');
		expect(toAreaName(reverseTromso)).toBe('Tromsø');
	});

	it('has no name for the open sea, and rejects an unexpected answer', () => {
		expect(toAreaName({ error: 'Unable to geocode' })).toBeNull();
		expect(() => toAreaName({ name: 42 })).toThrow(WeatherServiceError);
	});

	it("identifies the app, asks in the reader's language and skips a second request within a second", async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => Response.json(reverseBratislava));
		expect(await reverseGeocode({ lat: 48.1512, lon: 17.1077 }, 'sk', fetchFn)).toBe('Bratislava');
		const [input, init] = fetchFn.mock.calls[0];
		const url = new URL(String(input));
		expect(url.hostname).toBe('nominatim.openstreetmap.org');
		expect(url.searchParams.get('lat')).toBe('48.15');
		expect(url.searchParams.get('accept-language')).toBe('sk');
		expect(new Headers(init?.headers).get('user-agent')).toContain('SkySense');
		await expect(reverseGeocode({ lat: 40.42, lon: -3.7 }, 'en', fetchFn)).rejects.toThrow(
			WeatherServiceError
		);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});
});

describe('toArea', () => {
	it('turns a day on 49 points into hour and day records, and rejects anything else', () => {
		const cells = toArea(areaBratislava);
		expect(cells).toHaveLength(49);
		expect(cells[24].hours).toHaveLength(24);
		expect(cells[24].hours[0].time).toBe('2026-11-10T00:00');
		expect(cells[24].day?.sunrise).toMatch(/^2026-11-10T06:\d\d$/);
		expect(() => toArea({ hourly: {} })).toThrow(WeatherServiceError);
	});
});
