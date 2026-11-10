import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/forecast-bratislava.json';
import heat from '#lib/server/fixtures/scenario-heat.json';
import norilsk from '#lib/server/fixtures/forecast-norilsk.json';
import singapore from '#lib/server/fixtures/forecast-singapore.json';
import { toForecast } from '#lib/server/open-meteo.js';
import { summarize } from './summary.js';
import type { Hour } from './weather.js';

const hour = (i: number, rainChance: number, extra: Partial<Hour> = {}): Hour => ({
	time: `2026-11-10T${String(i).padStart(2, '0')}:00`,
	temp: 10,
	feels: 8,
	condition: rainChance >= 50 ? 'rain' : 'cloudy',
	isDay: true,
	rainChance,
	rain: 0,
	wind: 10,
	gust: 20,
	uv: 1,
	...extra
});
const day = (chances: (i: number) => number, extra: (i: number) => Partial<Hour> = () => ({})) =>
	Array.from({ length: 24 }, (_, i) => hour(i, chances(i), extra(i)));

describe('summarize', () => {
	it('says dry when no hour is likely wet', () => {
		expect(
			summarize(
				day(() => 10),
				10
			)
		).toEqual([{ key: 'dry' }]);
	});

	it('says when rain starts and how long it lasts', () => {
		expect(
			summarize(
				day((i) => (i >= 14 && i < 16 ? 80 : 10)),
				10
			)
		).toEqual([{ key: 'later', fall: 'rain', from: '2026-11-10T14:00', hours: 2 }]);
	});

	it('says when rain that is falling stops, or that it lasts', () => {
		expect(
			summarize(
				day((i) => (i < 3 ? 80 : 10)),
				10
			)[0]
		).toEqual({
			key: 'now',
			fall: 'rain',
			until: '2026-11-10T03:00'
		});
		expect(
			summarize(
				day(() => 80),
				10
			)[0]
		).toEqual({ key: 'all', fall: 'rain' });
		expect(
			summarize(
				day((i) => (i >= 20 ? 80 : 10)),
				10
			)[0]
		).toMatchObject({ key: 'rest' });
	});

	it('adds strong gusts first, then frost, then heat', () => {
		const gusty = summarize(
			day(
				() => 10,
				(i) => ({ gust: i === 5 ? 75 : 20, temp: -2 })
			),
			3
		);
		expect(gusty[1]).toEqual({ key: 'gusts', gust: 75, time: '2026-11-10T05:00' });
		const frosty = summarize(
			day(
				() => 10,
				(i) => ({ temp: 4 - i })
			),
			4
		);
		expect(frosty[1]).toEqual({ key: 'frost', min: -19, time: '2026-11-10T04:00' });
	});

	it('does not call frost news when it is already freezing', () => {
		expect(
			summarize(
				day(
					() => 10,
					() => ({ temp: -5 })
				),
				-5
			)
		).toEqual([{ key: 'dry' }]);
	});

	it('hedges when the model runs disagree, and only then', () => {
		const spread = (rain: number) => ({ spread: { low: 9, high: 11, rain } });
		const later = (share: number) =>
			summarize(
				day(
					(i) => (i >= 14 && i < 16 ? 80 : 10),
					(i) => spread(i === 14 ? share : 0)
				),
				10
			).map((s) => s.key);
		expect(later(30)).toEqual(['later', 'timingUnsure']);
		expect(later(90)).toEqual(['later']);

		const dry = (share: number) =>
			summarize(
				day(
					() => 10,
					(i) => spread(i === 20 ? share : 0)
				),
				10
			).map((s) => s.key);
		expect(dry(45)).toEqual(['dry', 'dryUnsure']);
		expect(dry(20)).toEqual(['dry']);
	});

	it('reads the recorded forecasts', () => {
		const of = (raw: unknown) => {
			const f = toForecast(raw);
			return summarize(f.hours, f.current.temp);
		};
		expect(of(bratislava)[0]).toEqual({ key: 'now', fall: 'rain', until: '2026-11-10T16:00' });
		expect(of(norilsk)).toEqual([{ key: 'dry' }]);
		// 17:45 in Singapore: tomorrow's 30° at noon is not news yet.
		expect(of(singapore)).toEqual([{ key: 'now', fall: 'rain', until: '2026-11-10T23:00' }]);
		expect(of(heat)[1]).toEqual({ key: 'heat', max: 35.1, time: '2026-07-10T16:00' });
	});
});
