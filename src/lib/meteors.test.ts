import { describe, expect, it } from 'vitest';
import { meteorPeak, nightClouds } from './meteors.js';

describe('meteorPeak', () => {
	it('names the shower that peaks tonight or tomorrow night', () => {
		expect(meteorPeak('2026-12-13')).toMatchObject({ shower: { id: 'geminids' }, days: 0 });
		expect(meteorPeak('2026-08-11')).toMatchObject({ shower: { id: 'perseids' }, days: 1 });
	});

	it('is quiet on other nights', () => {
		expect(meteorPeak('2026-11-10')).toBeNull();
		expect(meteorPeak('2026-12-15')).toBeNull();
	});
});

describe('nightClouds', () => {
	const hour = (time: string, clouds?: number) => ({ time, clouds });

	it('averages the cloud cover from 22:00 to 03:00, across midnight and the month', () => {
		const hours = [
			hour('2026-11-30T21:00', 0),
			hour('2026-11-30T22:00', 100),
			hour('2026-11-30T23:00', 80),
			hour('2026-12-01T03:00', 60),
			hour('2026-12-01T04:00', 0)
		];
		expect(nightClouds(hours, '2026-11-30')).toBe(80);
	});

	it('gives null when the hours have no cloud cover', () => {
		expect(nightClouds([hour('2026-11-30T23:00')], '2026-11-30')).toBeNull();
	});
});
