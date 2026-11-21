// The place page's tiles in the reader's order, size and visibility (U-26, U-27). Kept in a cookie
// like the units, so the server renders the first paint in the reader's layout.

export const TILES_COOKIE = 'skysense_tiles';

/** The default order, which is also the list of tiles the reader can arrange. */
export const TILE_IDS = [
	'umbrella',
	'activities',
	'hours',
	'chart',
	'tomorrow',
	'days',
	'details',
	'wind',
	'dark',
	'past'
] as const;

export type TileId = (typeof TILE_IDS)[number];

/** Full width across the two-column grid, or half. */
const WIDE_BY_DEFAULT: TileId[] = ['hours', 'chart', 'tomorrow', 'past'];

export type Tile = { id: TileId; wide: boolean; hidden: boolean };

export const defaultTiles = (): Tile[] =>
	TILE_IDS.map((id) => ({ id, wide: WIDE_BY_DEFAULT.includes(id), hidden: false }));

const isTileId = (id: string): id is TileId => (TILE_IDS as readonly string[]).includes(id);

/**
 * `umbrella,activities,-wind,days:w,details:h`: the order, `-` for hidden, `:w` or `:h` for a size
 * other than the default. Unknown and repeated tiles are dropped, and tiles the cookie does not
 * name yet (added after it was written) join at their default place.
 */
export function readTiles(cookie: string | undefined): Tile[] {
	const tiles: Tile[] = [];
	for (const entry of (cookie ?? '').split(',')) {
		const match = /^(-?)([a-z]+)(?::([wh]))?$/.exec(entry.trim());
		if (!match || !isTileId(match[2]) || tiles.some((t) => t.id === match[2])) continue;
		const id = match[2];
		const wide = match[3] ? match[3] === 'w' : WIDE_BY_DEFAULT.includes(id);
		tiles.push({ id, wide, hidden: match[1] === '-' });
	}
	for (const [index, tile] of defaultTiles().entries()) {
		if (tiles.some((t) => t.id === tile.id)) continue;
		// After the tile that comes before it by default, or first.
		const before = TILE_IDS.slice(0, index).findLast((id) => tiles.some((t) => t.id === id));
		tiles.splice(before ? tiles.findIndex((t) => t.id === before) + 1 : 0, 0, tile);
	}
	return tiles;
}

export function writeTiles(tiles: Tile[]): string {
	return tiles
		.map((t) => {
			const size = t.wide === WIDE_BY_DEFAULT.includes(t.id) ? '' : t.wide ? ':w' : ':h';
			return `${t.hidden ? '-' : ''}${t.id}${size}`;
		})
		.join(',');
}

/** Moves the tile `id` to the place of `to` (before it when moving up, after it when moving down). */
export function moveTile(tiles: Tile[], id: TileId, to: TileId): Tile[] {
	const from = tiles.findIndex((t) => t.id === id);
	const target = tiles.findIndex((t) => t.id === to);
	if (from < 0 || target < 0 || from === target) return tiles;
	const next = tiles.filter((t) => t.id !== id);
	next.splice(target, 0, tiles[from]);
	return next;
}

/** Moves a tile one place up or down among the visible ones. */
export function stepTile(tiles: Tile[], id: TileId, step: -1 | 1): Tile[] {
	const visible = tiles.filter((t) => !t.hidden);
	const at = visible.findIndex((t) => t.id === id);
	const neighbour = visible[at + step];
	return neighbour ? moveTile(tiles, id, neighbour.id) : tiles;
}

export const updateTile = (tiles: Tile[], id: TileId, change: Partial<Omit<Tile, 'id'>>) =>
	tiles.map((t) => (t.id === id ? { ...t, ...change } : t));
