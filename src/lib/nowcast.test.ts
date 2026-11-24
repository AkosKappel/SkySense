import { describe, expect, it } from 'vitest';
import { rainAhead, rainTurn, type NowcastStep } from './nowcast.js';
import type { Hour } from './weather.js';
import { toNowcast } from './server/open-meteo.js';
import recorded from './server/fixtures/nowcast-bratislava.json';

const steps = (mm: number[]): NowcastStep[] =>
	mm.map((rain, i) => ({
		time: `2026-11-10T${String(10 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
		rain
	}));

describe('rainTurn', () => {
	it('says when rain starts or stops within the steps ahead', () => {
		expect(rainTurn(steps([0, 0, 0.3, 0.5]), '2026-11-10T10:00', false)).toEqual({
			turn: 'starts',
			at: '2026-11-10T10:30'
		});
		expect(rainTurn(steps([0.4, 0.2, 0, 0]), '2026-11-10T10:05', true)).toEqual({
			turn: 'stops',
			at: '2026-11-10T10:30'
		});
	});

	it('starts from the quarter hour now falls in', () => {
		expect(rainTurn(steps([0.5, 0, 0, 0, 0.2]), '2026-11-10T10:20', false)).toEqual({
			turn: 'starts',
			at: '2026-11-10T11:00'
		});
	});

	it('says nothing when nothing changes', () => {
		expect(rainTurn(steps([0, 0.05, 0, 0]), '2026-11-10T10:00', false)).toBeNull();
		expect(rainTurn(steps([0.3, 0.3, 0.3, 0.3]), '2026-11-10T10:00', true)).toBeNull();
		expect(rainTurn([], '2026-11-10T10:00', false)).toBeNull();
	});

	it('stays quiet where the 15-minute models disagree with the hourly answer', () => {
		expect(rainTurn(steps([0, 0, 0.3, 0.5]), '2026-11-10T10:00', true)).toBeNull();
		expect(rainTurn(steps([0.4, 0.2, 0, 0]), '2026-11-10T10:00', false)).toBeNull();
	});

	it('reads a recorded morning', () => {
		const recordedSteps = toNowcast(recorded);
		expect(recordedSteps.length).toBeGreaterThan(8);
		expect(recordedSteps[0].time).toMatch(/^2026-11-10T00:00$/);
	});
});

describe('rainAhead', () => {
	const hours = (chances: number[]) =>
		chances.map((rainChance, i) => ({
			time: `2026-11-10T${String(10 + i).padStart(2, '0')}:00`,
			rainChance
		})) as Hour[];

	it('takes the quarter hours where there are some', () => {
		expect(rainAhead(steps([0, 0, 0.3, 0.5]), hours([10, 80]), '2026-11-10T10:05')).toEqual({
			turn: 'starts',
			at: '2026-11-10T10:30',
			quarter: true
		});
		// Quarter hours that see no change win over the hourly guess.
		expect(rainAhead(steps([0, 0, 0, 0]), hours([10, 80]), '2026-11-10T10:05')).toBeNull();
	});

	it('falls back to the next hour elsewhere', () => {
		expect(rainAhead(undefined, hours([10, 80]), '2026-11-10T10:05')).toEqual({
			turn: 'starts',
			at: '2026-11-10T11:00',
			quarter: false
		});
		expect(rainAhead(undefined, hours([90, 20]), '2026-11-10T10:05')?.turn).toBe('stops');
		expect(rainAhead(undefined, hours([90, 90]), '2026-11-10T10:05')).toBeNull();
		expect(rainAhead([], hours([10]), '2026-11-10T10:05')).toBeNull();
		// Quarter hours that have all gone by give way to the hours.
		expect(rainAhead(steps([0, 0]), hours([10, 80]), '2026-11-10T13:05')?.quarter).toBe(false);
	});
});
