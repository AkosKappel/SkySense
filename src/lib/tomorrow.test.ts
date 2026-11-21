import { describe, expect, it } from 'vitest';
import { tomorrowOutlook } from './tomorrow.js';
import type { Day, Hour } from './weather.js';

const day = (date: string, max: number): Day => ({
	date,
	condition: 'cloudy',
	max,
	min: max - 6,
	rainChance: 0,
	rain: 0,
	sunrise: null,
	sunset: null,
	uvMax: 1
});

const hours = (wet: Record<number, Hour['condition']> = {}): Hour[] =>
	Array.from({ length: 48 }, (_, i) => {
		const date = i < 24 ? '2026-11-10' : '2026-11-11';
		const hour = i % 24;
		const condition = i >= 24 ? (wet[hour] ?? 'cloudy') : 'cloudy';
		return {
			time: `${date}T${String(hour).padStart(2, '0')}:00`,
			temp: 5,
			feels: 3,
			condition,
			isDay: hour > 7 && hour < 17,
			rainChance: i >= 24 && wet[hour] ? 80 : 10,
			rain: 0,
			wind: 10,
			gust: 20,
			uv: 0
		};
	});

const days = (today: number, tomorrow: number) => [
	day('2026-11-10', today),
	day('2026-11-11', tomorrow)
];

describe('tomorrowOutlook', () => {
	it('compares the highs, with less than 2 degrees as about the same', () => {
		expect(tomorrowOutlook(days(7, 11), hours())?.temp).toEqual({ key: 'warmer', diff: 4 });
		expect(tomorrowOutlook(days(7, 4), hours())?.temp).toEqual({ key: 'colder', diff: 3 });
		expect(tomorrowOutlook(days(7, 8.5), hours())?.temp.key).toBe('same');
	});

	it('finds rain in the waking hours, and ignores the night', () => {
		const night = tomorrowOutlook(days(7, 7), hours({ 2: 'rain', 3: 'rain' }));
		expect(night?.fall).toEqual({ key: 'dry' });
		expect(night?.condition).toBe('cloudy');
		expect(tomorrowOutlook(days(7, 7), hours({ 9: 'rain', 10: 'rain' }))?.fall).toEqual({
			key: 'window',
			kind: 'rain',
			from: '2026-11-11T09:00',
			until: '2026-11-11T11:00'
		});
	});

	it('says snow or storms, and "from" when it lasts into the evening', () => {
		expect(
			tomorrowOutlook(days(1, 1), hours({ 20: 'snow', 21: 'snow', 22: 'snow' }))?.fall
		).toEqual({ key: 'from', kind: 'snow', from: '2026-11-11T20:00' });
		const storm = tomorrowOutlook(days(7, 7), hours({ 15: 'thunder' }));
		expect(storm?.fall).toMatchObject({ kind: 'thunder' });
		expect(storm?.condition).toBe('thunder');
	});

	it('needs tomorrow in the forecast', () => {
		expect(tomorrowOutlook([day('2026-11-10', 7)], hours())).toBeNull();
	});
});
