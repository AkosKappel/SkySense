import { describe, expect, it } from 'vitest';
import { activities } from '#lib/activities.js';
import type { Day, Hour } from '#lib/weather.js';
import {
	areaPoints,
	areaSquares,
	betterAnswer,
	distanceAndDirection,
	scoreArea,
	type AreaCell
} from './better.js';

const day: Day = {
	date: '2026-11-14',
	condition: 'partly',
	max: 14,
	min: 6,
	rainChance: 0,
	rain: 0,
	sunrise: '2026-11-14T06:55',
	sunset: '2026-11-14T16:15',
	uvMax: 1
};
const hours = (rainChance: number): Hour[] =>
	Array.from({ length: 24 }, (_, h) => ({
		time: `2026-11-14T${String(h).padStart(2, '0')}:00`,
		temp: 12,
		feels: 12,
		condition: rainChance > 50 ? 'rain' : 'partly',
		isDay: h >= 7 && h < 16,
		rainChance,
		rain: rainChance > 50 ? 2 : 0,
		wind: 5,
		gust: 10,
		uv: 1
	}));
const cell = (lat: number, lon: number, rainChance: number): AreaCell => ({
	lat,
	lon,
	hours: hours(rainChance),
	day
});
const place = { lat: 48.15, lon: 17.11 };

describe('scoreArea', () => {
	it('gives a dry point a window and a rainy one a score below good', () => {
		const [dry, wet] = scoreArea(activities.run, [cell(48.15, 17.11, 0), cell(48.4, 17.11, 90)]);
		expect(dry.window).not.toBeNull();
		expect(dry.score).toBeGreaterThanOrEqual(60);
		expect(wet.window).toBeNull();
		expect(wet.score).toBeLessThan(60);
	});

	it('only looks at the hours from `from` on', () => {
		const [late] = scoreArea(activities.run, [cell(48.15, 17.11, 0)], 0, '2026-11-14T15:00');
		expect(late.window?.from).toBe('2026-11-14T15:00');
	});
});

describe('distanceAndDirection', () => {
	it('measures along the earth and names the compass point', () => {
		const south = distanceAndDirection(place, { lat: 47.69, lon: 17.63 });
		expect(south.metres / 1000).toBeCloseTo(65, -1);
		expect(south.toward).toBe('se');
		expect(distanceAndDirection(place, { lat: 48.6, lon: 17.11 }).toward).toBe('n');
	});
});

describe('betterAnswer', () => {
	it('points to the drier place away from the rain', () => {
		const scores = scoreArea(activities.run, [cell(48.15, 17.11, 90), cell(47.7, 17.6, 0)]);
		const answer = betterAnswer(scores, place);
		expect(answer.kind).toBe('better');
		if (answer.kind === 'better') expect(answer.best.lat).toBe(47.7);
	});

	it('stays here when here is as good, and says when nowhere is', () => {
		const even = scoreArea(activities.run, [cell(48.15, 17.11, 0), cell(47.7, 17.6, 0)]);
		expect(betterAnswer(even, place).kind).toBe('here');
		const wet = scoreArea(activities.run, [cell(48.15, 17.11, 90), cell(47.7, 17.6, 90)]);
		expect(betterAnswer(wet, place).kind).toBe('nowhere');
	});
});

describe('areaSquares', () => {
	it('tiles the grid edge to edge around the points asked for', () => {
		const squares = areaSquares(place);
		const points = areaPoints(place);
		expect(squares).toHaveLength(49);
		// Neighbours share an edge: no gap and no overlap.
		expect(squares[0][1][1]).toBeCloseTo(squares[1][0][1], 10);
		expect(squares[0][0][0]).toBeCloseTo(squares[7][1][0], 10);
		// Each square holds its rounded point.
		squares.forEach(([[south, west], [north, east]], i) => {
			expect(points[i].lat).toBeGreaterThan(south);
			expect(points[i].lat).toBeLessThan(north);
			expect(points[i].lon).toBeGreaterThan(west);
			expect(points[i].lon).toBeLessThan(east);
		});
	});
});
