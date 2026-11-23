import { describe, expect, it } from 'vitest';
import { seaState, seaToday } from './sea.js';
import { toMarine } from './server/open-meteo.js';
import singapore from './server/fixtures/marine-singapore.json';
import bratislava from './server/fixtures/marine-bratislava.json';

describe('seaToday', () => {
	it('finds the highest waves left today and the sea temperature now', () => {
		const hours = [
			{ time: '2026-07-10T09:00', waves: 0.4, temp: 24.1 },
			{ time: '2026-07-10T10:00', waves: 0.6, temp: 24.2 },
			{ time: '2026-07-10T15:00', waves: 1.4, temp: 24.5 },
			{ time: '2026-07-11T03:00', waves: 2.2, temp: 24 }
		];
		expect(seaToday(hours, '2026-07-10T10:15')).toEqual({
			highest: { height: 1.4, time: '2026-07-10T15:00' },
			temp: 24.2
		});
	});

	it('reads the recorded coast and says nothing inland', () => {
		const sea = seaToday(toMarine(singapore), '2026-11-10T10:00');
		expect(sea?.temp).toBeCloseTo(31.1);
		expect(sea?.highest.height).toBeGreaterThan(0);
		expect(seaToday(toMarine(bratislava), '2026-11-10T10:00')).toBeNull();
	});
});

describe('seaState', () => {
	it('follows the Douglas scale', () => {
		expect(seaState(0.1)).toBe('calm');
		expect(seaState(0.5)).toBe('slight');
		expect(seaState(1.8)).toBe('moderate');
		expect(seaState(3)).toBe('rough');
		expect(seaState(5)).toBe('veryRough');
	});
});
