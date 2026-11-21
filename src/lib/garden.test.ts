import { describe, expect, it } from 'vitest';
import { gardenAdvice, type GardenDay } from './garden.js';

// 2026-11-03 to 2026-11-09 before today (2026-11-10), then a week ahead.
const week = (over: (i: number) => Partial<GardenDay> = () => ({})): GardenDay[] =>
	Array.from({ length: 14 }, (_, i) => ({
		date: `2026-11-${String(i + 3).padStart(2, '0')}`,
		rain: 0,
		et0: 0.5,
		groundMin: 4,
		...over(i)
	}));

describe('gardenAdvice', () => {
	it('says nothing when the rain kept up and no frost is coming', () => {
		expect(gardenAdvice(week(), '2026-11-10')).toBeNull();
	});

	it('counts the shortfall of the days before today, from 10 mm', () => {
		const dry = week((i) => (i < 7 ? { et0: 2 } : {}));
		expect(gardenAdvice(dry, '2026-11-10')).toEqual({ short: 14, rainSoon: false, frost: [] });
		const nearly = week((i) => (i < 7 ? { et0: 1.4 } : {}));
		expect(gardenAdvice(nearly, '2026-11-10')).toBeNull();
	});

	it('waits for rain due today or tomorrow, not later', () => {
		const soon = week((i) => (i < 7 ? { et0: 2 } : i === 8 ? { rain: 6 } : {}));
		expect(gardenAdvice(soon, '2026-11-10')?.rainSoon).toBe(true);
		const later = week((i) => (i < 7 ? { et0: 2 } : i === 9 ? { rain: 6 } : {}));
		expect(gardenAdvice(later, '2026-11-10')?.rainSoon).toBe(false);
	});

	it('lists the days ahead with ground frost, ignoring past ones', () => {
		const frost = week((i) => (i === 2 || i === 8 || i === 12 ? { groundMin: -1 } : {}));
		expect(gardenAdvice(frost, '2026-11-10')?.frost).toEqual(['2026-11-11', '2026-11-15']);
	});

	it('stays quiet about frost once the whole past week froze', () => {
		expect(
			gardenAdvice(
				week(() => ({ groundMin: -5 })),
				'2026-11-10'
			)
		).toBeNull();
	});
});
