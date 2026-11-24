import { describe, expect, it } from 'vitest';
import type { Hour } from '#lib/weather.js';
import {
	burnInShift,
	isEvening,
	placeNow,
	upcoming,
	wallLayout,
	wallPresets,
	wallQuery
} from './wall.js';

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

describe('wallLayout', () => {
	const layout = (query: string) => wallLayout(new URLSearchParams(query));

	it('shows the standard wall without settings, or when nothing known is chosen', () => {
		const standard = { blocks: wallPresets.standard, size: 'm', night: 'dim', also: null };
		expect(layout('')).toEqual(standard);
		expect(layout('show=radio&size=xl&night=off&also=nowhere')).toEqual(standard);
	});

	it('keeps the chosen blocks in the wall order, whatever order the address has', () => {
		expect(layout('show=tomorrow&show=clock&show=clock&size=l')).toMatchObject({
			blocks: ['clock', 'tomorrow'],
			size: 'l'
		});
	});

	it('writes an address that reads back the same, plain for the standard wall', () => {
		const plain = {
			blocks: [...wallPresets.standard],
			size: 'm',
			night: 'dim',
			also: null
		} as const;
		expect(wallQuery({ ...plain, blocks: [...plain.blocks] })).toBe('');
		const clock = {
			blocks: [...wallPresets.clock],
			size: 'l',
			night: 'clock',
			also: { coordinates: { lat: 40.42, lon: -3.7 }, name: 'Madrid' }
		} as const;
		const query = wallQuery({ ...clock, blocks: [...clock.blocks] });
		expect(query).toBe(
			'?show=clock&show=date&show=now&size=l&night=clock&also=40.42%2C-3.7%2FMadrid'
		);
		expect(layout(query.slice(1))).toEqual(clock);
	});
});

describe('isEvening', () => {
	it('runs from sunset to midnight', () => {
		expect(isEvening('2026-11-13T16:20', '2026-11-13T16:21')).toBe(false);
		expect(isEvening('2026-11-13T21:00', '2026-11-13T16:21')).toBe(true);
		// After midnight the new day's sunset is still ahead.
		expect(isEvening('2026-11-14T01:00', '2026-11-14T16:20')).toBe(false);
		expect(isEvening('2026-12-20T12:00', null)).toBe(false);
	});
});
