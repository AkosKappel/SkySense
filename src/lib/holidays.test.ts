import { describe, expect, it } from 'vitest';
import { holidayLine, holidayName, holidaysWithin, type Holiday } from './holidays.js';
import { toHolidays } from './server/open-meteo.js';
import recorded from './server/fixtures/holidays-sk-2026.json';

const christmasEve: Holiday = {
	date: '2026-12-24',
	localName: 'Štedrý deň',
	name: 'Christmas Eve'
};

describe('holidayName', () => {
	it('uses the local name where the reader’s language is spoken', () => {
		expect(holidayName(christmasEve, 'sk', 'sk')).toBe('Štedrý deň');
		expect(holidayName({ ...christmasEve, localName: 'Nochebuena' }, 'mx', 'es')).toBe(
			'Nochebuena'
		);
	});

	it('falls back to English elsewhere', () => {
		expect(holidayName(christmasEve, 'sk', 'de')).toBe('Christmas Eve');
		expect(holidayName(christmasEve, 'sk', 'en')).toBe('Christmas Eve');
	});
});

describe('holidaysWithin', () => {
	it('keeps the recorded nationwide holidays in the window, across a month end', () => {
		const holidays = toHolidays(recorded);
		expect(holidaysWithin(holidays, '2026-11-10', 10).map((h) => h.date)).toEqual(['2026-11-17']);
		expect(holidaysWithin(holidays, '2026-12-20', 10).map((h) => h.date)).toEqual([
			'2026-12-24',
			'2026-12-25',
			'2026-12-26'
		]);
		expect(holidaysWithin(holidays, '2026-11-18', 5)).toEqual([]);
	});
});

describe('toHolidays', () => {
	it('drops regional holidays', () => {
		const regional = { date: '2026-01-06', localName: 'x', name: 'Epiphany', global: false };
		const national = { date: '2026-01-01', localName: 'y', name: 'New Year', global: true };
		expect(toHolidays([regional, national])).toEqual([
			{ date: '2026-01-01', localName: 'y', name: 'New Year' }
		]);
	});
});

describe('holidayLine', () => {
	const holidays = { country: 'sk', days: [christmasEve] };

	it('names today’s holiday, else tomorrow’s, for the reader', () => {
		expect(holidayLine(holidays, '2026-12-24', 'sk')).toEqual({
			when: 'today',
			name: 'Štedrý deň'
		});
		expect(holidayLine(holidays, '2026-12-23', 'en')).toEqual({
			when: 'tomorrow',
			name: 'Christmas Eve'
		});
	});

	it('says nothing further ahead or without holidays', () => {
		expect(holidayLine(holidays, '2026-12-20', 'en')).toBeNull();
		expect(holidayLine(undefined, '2026-12-24', 'en')).toBeNull();
	});
});
