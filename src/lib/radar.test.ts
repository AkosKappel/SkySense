import { describe, expect, it } from 'vitest';
import bratislavaGrid from '#lib/server/fixtures/grid-bratislava.json';
import frames from '#lib/server/fixtures/radar-frames.json';
import { gridPoints, toGrid, toRadarFrames } from '#lib/server/open-meteo.js';
import { firstWetHour, type GridCell } from './radar.js';

const cell = (rain: number[]): GridCell => ({
	lat: 48,
	lon: 17,
	hours: rain.map((mm, i) => ({ time: `2026-11-10T1${i}:00`, rain: mm, chance: 0 }))
});

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

describe('radar frames', () => {
	it('keeps the host and the past frames', () => {
		const radar = toRadarFrames(frames);
		expect(radar.host).toBe('https://tilecache.rainviewer.com');
		expect(radar.frames).toHaveLength(13);
		expect(radar.frames.at(-1)!.time).toBe(Date.UTC(2026, 10, 10, 9) / 1000);
	});
});
