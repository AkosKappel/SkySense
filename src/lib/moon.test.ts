import { describe, expect, it } from 'vitest';
import { moon, nextPhase } from './moon.js';

describe('moon', () => {
	// Eclipses only happen at full moon (lunar) and new moon (solar), so they make good anchors.
	it('is full at the lunar eclipses of 3 March and 28 August 2026', () => {
		for (const time of ['2026-03-03T11:30', '2026-08-28T04:00']) {
			expect(moon(time).phase).toBe('full');
			expect(moon(time).illumination).toBeGreaterThan(0.98);
		}
	});

	it('is new at the solar eclipse of 12 August 2026', () => {
		expect(moon('2026-08-12T17:45').phase).toBe('new');
		expect(moon('2026-08-12T17:45').illumination).toBeLessThan(0.02);
	});

	it('waxes after new moon and wanes after full moon', () => {
		expect(moon('2026-08-16T12:00').phase).toBe('waxingCrescent');
		expect(moon('2026-08-20T12:00').phase).toBe('firstQuarter');
		expect(moon('2026-09-04T12:00').phase).toBe('lastQuarter');
	});
});

describe('nextPhase', () => {
	const sky = { fullMoon: '2026-11-24T15:53', newMoon: '2026-12-09T01:51' };

	it('picks the sooner of the full and new moon', () => {
		expect(nextPhase(sky, '2026-11-10')).toEqual({ phase: 'full', at: sky.fullMoon, today: false });
		expect(nextPhase({ ...sky, fullMoon: '2026-12-24T02:28' }, '2026-11-26').phase).toBe('new');
	});

	it('says when it falls on the day shown', () => {
		expect(nextPhase(sky, '2026-11-24').today).toBe(true);
	});
});
