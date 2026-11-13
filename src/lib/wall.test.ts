import { describe, expect, it } from 'vitest';
import type { Hour } from '#lib/weather.js';
import { burnInShift, placeNow, upcoming } from './wall.js';

describe('placeNow', () => {
	it("gives the place's wall-clock time, not the reader's", () => {
		const utc = Date.UTC(2026, 10, 13, 23, 30);
		expect(placeNow(3600, utc)).toBe('2026-11-14T00:30');
		expect(placeNow(-5 * 3600, utc)).toBe('2026-11-13T18:30');
	});
});

describe('upcoming', () => {
	const hours = ['10', '11', '12'].map((h) => ({ time: `2026-11-13T${h}:00` }) as Hour);

	it('keeps the current hour and the ones after it', () => {
		expect(upcoming(hours, '2026-11-13T11:45').map((h) => h.time)).toEqual([
			'2026-11-13T11:00',
			'2026-11-13T12:00'
		]);
	});
});

describe('burnInShift', () => {
	it('moves a few pixels each hour and comes back after nine', () => {
		const shifts = Array.from({ length: 9 }, (_, hour) => JSON.stringify(burnInShift(hour)));
		expect(new Set(shifts).size).toBe(9);
		expect(burnInShift(9)).toEqual(burnInShift(0));
		expect(Math.max(...Array.from({ length: 24 }, (_, h) => Math.abs(burnInShift(h).x)))).toBe(4);
	});
});
