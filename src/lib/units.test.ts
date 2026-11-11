import { describe, expect, it } from 'vitest';
import { defaultUnits, readUnits } from './settings.js';
import { beaufort, formatRain, formatWind, imperial, metric, temperature } from './units.js';

describe('conversions', () => {
	it('converts temperature', () => {
		expect(temperature(6, metric)).toBe(6);
		expect(temperature(6, imperial)).toBe(43);
		expect(temperature(-40, imperial)).toBe(-40);
	});

	it.each([
		[0, 0],
		[1.9, 0],
		[2, 1],
		[19.9, 3],
		[20, 4],
		[117, 11],
		[118, 12],
		[200, 12]
	])('%f km/h is Beaufort %i', (kmh, force) => {
		expect(beaufort(kmh)).toBe(force);
	});

	it('formats wind in each unit', () => {
		expect(formatWind(36, metric)).toBe('36 km/h');
		expect(formatWind(36, { ...metric, wind: 'ms' })).toBe('10 m/s');
		expect(formatWind(36, imperial)).toBe('22 mph');
		expect(formatWind(37.04, { ...metric, wind: 'kn' })).toBe('20 kn');
		expect(formatWind(36, { ...metric, wind: 'bft' })).toBe('Bft 5');
	});

	it('formats rain', () => {
		expect(formatRain(2.54, metric)).toBe('2.5 mm');
		expect(formatRain(25.4, imperial)).toBe('1.00 in');
		expect(formatRain(1.44, metric, 'de')).toBe('1,4 mm');
		expect(formatRain(1234, metric, 'en')).toBe('1,234.0 mm');
	});
});

describe('unit settings', () => {
	it('defaults to imperial only for US English', () => {
		expect(defaultUnits('en-US,en;q=0.9')).toEqual(imperial);
		expect(defaultUnits('en-GB,en;q=0.9')).toEqual(metric);
		expect(defaultUnits('de-DE')).toEqual(metric);
		expect(defaultUnits(null)).toEqual(metric);
	});

	it('reads a stored choice', () => {
		const stored = JSON.stringify({ temperature: 'f', wind: 'bft', rain: 'mm', clock: '24' });
		expect(readUnits(stored, metric)).toEqual({
			temperature: 'f',
			wind: 'bft',
			rain: 'mm',
			clock: '24'
		});
	});

	it('falls back per unit for unknown or damaged values', () => {
		expect(readUnits(JSON.stringify({ temperature: 'kelvin', wind: 'kn' }), imperial)).toEqual({
			...imperial,
			wind: 'kn'
		});
		expect(readUnits('{not json', metric)).toEqual(metric);
		expect(readUnits(undefined, metric)).toEqual(metric);
	});
});
