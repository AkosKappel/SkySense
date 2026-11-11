import { describe, expect, it } from 'vitest';
import { drySpell } from './recent.js';

const days = (rains: number[], start = '2026-10-28') =>
	rains.map((rain, i) => {
		const d = new Date(`${start}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + i);
		return { date: d.toISOString().slice(0, 10), rain };
	});

describe('drySpell', () => {
	it('finds the last day with 1 mm or more and counts the dry days since', () => {
		// 28 Oct to 9 Nov; rain on 3 Nov (4 mm), a trace on 8 Nov does not count.
		const spell = drySpell(days([0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0.3, 0]), '2026-11-10');
		expect(spell?.last).toEqual({ date: '2026-11-03', rain: 4 });
		expect(spell?.dryDays).toBe(6);
		expect(spell?.month).toEqual({ rain: 4.3, rainDays: 1 });
	});

	it('says 0 dry days when it rained yesterday', () => {
		expect(drySpell(days([0, 0, 5]), '2026-10-31')?.dryDays).toBe(0);
	});

	it('ignores today and has no month on the first', () => {
		const spell = drySpell(days([0, 0, 0, 0, 9]), '2026-11-01');
		expect(spell?.last).toBeNull();
		expect(spell?.dryDays).toBe(4);
		expect(spell?.covered).toBe(4);
		expect(spell?.month).toBeNull();
	});

	it('gives nothing without past days', () => {
		expect(drySpell([], '2026-11-10')).toBeNull();
	});
});
