import { describe, expect, it } from 'vitest';
import {
	defaultTiles,
	moveTile,
	readTiles,
	stepTile,
	TILE_IDS,
	updateTile,
	writeTiles
} from './tiles.js';

const ids = (tiles: { id: string }[]) => tiles.map((t) => t.id);

describe('readTiles', () => {
	it('gives the default layout without a cookie or with a damaged one', () => {
		expect(readTiles(undefined)).toEqual(defaultTiles());
		expect(readTiles('%%,<script>,umbrella:x')).toEqual(defaultTiles());
	});

	it('reads order, hidden tiles and sizes, dropping unknown and repeated ones', () => {
		const tiles = readTiles(
			'days,-wind,hours:h,umbrella:w,radar,days,activities,chart,tomorrow,details,dark,past'
		);
		expect(ids(tiles).slice(0, 5)).toEqual(['days', 'wind', 'hours', 'umbrella', 'activities']);
		expect(tiles[1]).toEqual({ id: 'wind', wide: false, hidden: true });
		expect(tiles[2].wide).toBe(false);
		expect(tiles[3].wide).toBe(true);
		expect(tiles).toHaveLength(TILE_IDS.length);
	});

	it('puts a tile the cookie does not name yet after its default neighbour', () => {
		const tiles = readTiles('days,umbrella,activities,hours,chart,details,wind,dark,past');
		expect(ids(tiles)).toEqual([
			'days',
			'umbrella',
			'activities',
			'hours',
			'chart',
			'tomorrow',
			'details',
			'wind',
			'dark',
			'past'
		]);
	});

	it('round-trips through writeTiles, writing only what differs from the default', () => {
		const tiles = updateTile(moveTile(defaultTiles(), 'days', 'umbrella'), 'wind', {
			hidden: true,
			wide: true
		});
		const cookie = writeTiles(tiles);
		expect(cookie.startsWith('days,umbrella,')).toBe(true);
		expect(cookie).toContain('-wind:w');
		expect(cookie).toContain(',hours,');
		expect(readTiles(cookie)).toEqual(tiles);
	});
});

describe('moving tiles', () => {
	it('moves a tile to another tile’s place, up or down', () => {
		expect(ids(moveTile(defaultTiles(), 'chart', 'umbrella')).slice(0, 4)).toEqual([
			'chart',
			'umbrella',
			'activities',
			'hours'
		]);
		expect(ids(moveTile(defaultTiles(), 'umbrella', 'hours')).slice(0, 4)).toEqual([
			'activities',
			'hours',
			'umbrella',
			'chart'
		]);
	});

	it('steps over hidden tiles and stops at the ends', () => {
		const tiles = updateTile(defaultTiles(), 'activities', { hidden: true });
		expect(ids(stepTile(tiles, 'hours', -1)).slice(0, 3)).toEqual([
			'hours',
			'umbrella',
			'activities'
		]);
		expect(stepTile(tiles, 'umbrella', -1)).toBe(tiles);
		expect(stepTile(tiles, 'past', 1)).toBe(tiles);
	});
});
