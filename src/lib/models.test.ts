import { describe, expect, it } from 'vitest';
import bratislava from '#lib/server/fixtures/models-bratislava.json';
import { toModelRuns } from '#lib/server/open-meteo.js';
import { rainTotal, widestGap, type ModelRun } from './models.js';

const run = (id: ModelRun['id'], temps: number[], rain = 0): ModelRun => ({
	id,
	hours: temps.map((temp, i) => ({
		time: `2026-11-10T${String(i).padStart(2, '0')}:00`,
		temp,
		rain
	}))
});

describe('model comparison', () => {
	it('finds the hour the models are furthest apart', () => {
		const runs = [run('ecmwf_ifs025', [5, 6, 7]), run('gfs_seamless', [5, 9, 8])];
		expect(widestGap(runs, '2026-11-10T00:00', 24)).toEqual({ gap: 3, time: '2026-11-10T01:00' });
		expect(widestGap(runs, '2026-11-10T02:00', 24)).toEqual({ gap: 1, time: '2026-11-10T02:00' });
	});

	it('adds up rain from a given hour', () => {
		expect(rainTotal(run('icon_seamless', [1, 1, 1, 1], 0.5), '2026-11-10T01:00', 2)).toBe(1);
	});

	it('reads a recorded comparison, cutting each model where its range ends', () => {
		const runs = toModelRuns(bratislava);
		expect(runs.map((r) => r.id)).toEqual([
			'ecmwf_ifs025',
			'gfs_seamless',
			'icon_seamless',
			'meteofrance_seamless',
			'ukmo_seamless'
		]);
		expect(runs.every((r) => r.hours.length >= 72)).toBe(true);
		expect(runs.every((r) => r.hours.every((h) => typeof h.temp === 'number'))).toBe(true);
	});

	it('leaves out a model that sent nothing', () => {
		expect(
			toModelRuns({
				hourly: {
					time: ['2026-11-10T00:00'],
					temperature_2m_gfs_seamless: [4],
					precipitation_gfs_seamless: [0]
				}
			}).map((r) => r.id)
		).toEqual(['gfs_seamless']);
	});
});
