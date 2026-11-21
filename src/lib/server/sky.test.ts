import { describe, expect, it } from 'vitest';
import { skyEvents } from './sky.js';

const minutes = (local: string | null) => Date.parse(`${local}Z`) / 60_000;

describe('skyEvents', () => {
	// Bratislava at 06:00 on 10 November 2026 (UTC+1). The US Naval Observatory gives moonrise
	// at 08:23 and moonset at 16:23; the new moon was on 9 November, the full moon is on the 24th.
	const sky = skyEvents({ lat: 48.15, lon: 17.11 }, '2026-11-10T06:00', 3600);

	it('finds the next moonrise and moonset within a few minutes of published times', () => {
		expect(Math.abs(minutes(sky.moonrise) - minutes('2026-11-10T08:23'))).toBeLessThanOrEqual(3);
		expect(Math.abs(minutes(sky.moonset) - minutes('2026-11-10T16:23'))).toBeLessThanOrEqual(3);
	});

	it('gives the next full and new moon in local time', () => {
		expect(sky.fullMoon.slice(0, 10)).toBe('2026-11-24');
		expect(sky.newMoon.slice(0, 10)).toBe('2026-12-09');
	});

	it('says nothing when the moon stays up or down all day', () => {
		// Tromsø, 2026-11-26: the moon, near full and far north, stays above the horizon.
		const days = Array.from({ length: 28 }, (_, i) =>
			skyEvents({ lat: 69.65, lon: 18.96 }, `2026-11-${String(i + 1).padStart(2, '0')}T12:00`, 3600)
		);
		expect(days.some((d) => d.moonrise === null || d.moonset === null)).toBe(true);
	});
});

describe('eclipses and planets', () => {
	const bratislava = skyEvents({ lat: 48.15, lon: 17.11 }, '2026-11-10T06:00', 3600);

	it('finds an eclipse within two weeks only where it can be seen', () => {
		// 12 August 2026: total in Valencia at sunset, partial in Madrid; 28 August: a partial
		// lunar eclipse at 04:13 UTC, with the moon still up over Madrid.
		const valencia = skyEvents({ lat: 39.47, lon: -0.38 }, '2026-08-05T12:00', 7200).eclipse;
		expect(valencia).toEqual({ body: 'sun', kind: 'total', at: '2026-08-12T20:32' });
		const madrid = skyEvents({ lat: 40.42, lon: -3.7 }, '2026-08-20T12:00', 7200).eclipse;
		expect(madrid).toEqual({ body: 'moon', kind: 'partial', at: '2026-08-28T06:12' });
		expect(bratislava.eclipse).toBeNull();
	});

	it('lists the bright planets up after dusk, and none under the midnight sun', () => {
		expect(bratislava.planets).toEqual(['saturn']);
		expect(skyEvents({ lat: 69.65, lon: 18.96 }, '2026-06-20T06:00', 7200).planets).toEqual([]);
	});
});
