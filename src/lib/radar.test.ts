import { describe, expect, it } from 'vitest';
import bratislavaGrid from '#lib/server/fixtures/grid-bratislava.json';
import frames from '#lib/server/fixtures/radar-frames.json';
import { gridPoints, toGrid, toRadarFrames } from '#lib/server/open-meteo.js';
import { firstWetHour, temperatureBand, warmerSide, windAround, type GridCell } from './radar.js';

const cell = (rain: number[]): GridCell => ({
	lat: 48,
	lon: 17,
	hours: rain.map((mm, i) => ({
		time: `2026-11-10T1${i}:00`,
		rain: mm,
		chance: 0,
		temperature: 10,
		wind: 0,
		windFrom: 0
	}))
});

const TIME = '2026-11-10T10:00';
/** A 3 × 3 grid, rows north to south and columns west to east, with one value per point. */
const grid = (values: { temperature?: number; wind?: number; windFrom?: number }[]): GridCell[] =>
	values.map((v, i) => ({
		lat: 49 - Math.floor(i / 3),
		lon: 16 + (i % 3),
		hours: [{ time: TIME, rain: 0, chance: 0, temperature: 10, wind: 0, windFrom: 0, ...v }]
	}));
const temperatures = (t: number[]) => grid(t.map((temperature) => ({ temperature })));

describe('rain grid', () => {
	it('spaces 25 points evenly around the place, wider in longitude far from the equator', () => {
		const points = gridPoints({ lat: 48.15, lon: 17.11 });
		expect(points).toHaveLength(25);
		expect(points[12]).toEqual({ lat: 48.15, lon: 17.11 });
		expect(points[0].lat).toBeCloseTo(48.75);
		// 0.3° of latitude is about 33 km; at 48° that takes about 0.45° of longitude.
		expect(points[13].lon - points[12].lon).toBeCloseTo(0.45, 1);
	});

	it('reads a recorded grid', () => {
		const grid = toGrid(bratislavaGrid);
		expect(grid).toHaveLength(25);
		expect(grid[0].hours.map((h) => h.time)).toEqual([
			'2026-11-10T10:00',
			'2026-11-10T11:00',
			'2026-11-10T12:00',
			'2026-11-10T13:00'
		]);
	});

	it('finds the first hour any point is wet, from 0.2 mm', () => {
		expect(firstWetHour([cell([0, 0.1, 0]), cell([0, 0, 0.4])])).toBe('2026-11-10T12:00');
		expect(firstWetHour([cell([0, 0.1, 0])])).toBeNull();
		expect(firstWetHour([])).toBeNull();
	});
});

describe('temperature and wind layers', () => {
	it('reads temperature and wind from the recorded grid', () => {
		const middle = toGrid(bratislavaGrid)[12].hours[0];
		expect(middle).toMatchObject({ temperature: 5.4, wind: 12.9 });
		expect(middle.windFrom).toBeGreaterThanOrEqual(0);
	});

	it('names the warmer side when opposite edges differ by 2° or more', () => {
		expect(warmerSide(temperatures([8, 8, 8, 6, 6, 6, 4, 4, 4]), TIME)).toEqual({
			side: 'n',
			by: 4
		});
		expect(warmerSide(temperatures([4, 6, 9, 4, 6, 9, 4, 6, 9]), TIME)).toEqual({
			side: 'e',
			by: 5
		});
		expect(warmerSide(temperatures([5, 5, 3, 5, 5, 3, 5, 5, 3]), TIME)).toEqual({
			side: 'w',
			by: 2
		});
		expect(warmerSide(temperatures([5, 5, 5, 5, 5, 5, 6, 6, 6]), TIME)).toBeNull();
		expect(warmerSide(temperatures([NaN, 5, 5, 5, 5, 5, 5, 5, 5]), TIME)).toBeNull();
		// The recorded grids list points south to north; sides come from the coordinates.
		expect(warmerSide(temperatures([8, 8, 8, 6, 6, 6, 4, 4, 4]).reverse(), TIME)?.side).toBe('n');
		expect(warmerSide([], TIME)).toBeNull();
	});

	it('colours temperatures blue at freezing and below, yellow from 25°', () => {
		expect([-3, 0, 0.5, 24.9, 25].map(temperatureBand)).toEqual([
			'cold',
			'cold',
			'mild',
			'mild',
			'warm'
		]);
	});

	it('averages wind directions as vectors and gives the strongest speed', () => {
		const around = windAround(
			grid([
				{ wind: 20, windFrom: 350 },
				{ wind: 20, windFrom: 10 },
				{ wind: 5, windFrom: 180 }
			]),
			TIME
		);
		expect(around).toEqual({ from: 'n', max: 20 });
		expect(windAround(grid([{ wind: 2, windFrom: 90 }]), TIME)).toBeNull();
		expect(windAround(grid([{ wind: 15, windFrom: 260 }]), '2026-11-10T11:00')).toBeNull();
	});
});

describe('radar frames', () => {
	it('keeps the host and the past frames', () => {
		const radar = toRadarFrames(frames);
		expect(radar.host).toBe('https://tilecache.rainviewer.com');
		expect(radar.frames).toHaveLength(13);
		expect(radar.frames.at(-1)!.time).toBe(Date.UTC(2026, 10, 10, 9) / 1000);
	});
});
