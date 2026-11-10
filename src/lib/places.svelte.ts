// Saved places stay on this device (D-07). Storage can be missing or blocked (private windows),
// so every access is guarded and the app works without it.
import { browser } from '$app/env';
import { formatCoordinates, type Coordinates } from '#lib/weather.js';

export type SavedPlace = Coordinates & { name: string; detail?: string };

const KEY = 'skysense.places';
export const MAX_PLACES = 10;
/** The last place opened, read on the server to open it again from `/`. */
export const LAST_PLACE_COOKIE = 'skysense_last';

function read(): SavedPlace[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(p): p is SavedPlace =>
				typeof p?.name === 'string' && typeof p?.lat === 'number' && typeof p?.lon === 'number'
		);
	} catch {
		return [];
	}
}

const same = (a: Coordinates, b: Coordinates) => formatCoordinates(a) === formatCoordinates(b);

class SavedPlaces {
	list = $state<SavedPlace[]>(browser ? read() : []);

	constructor() {
		// Another tab saved, removed or renamed a place (F-19); `key` is null when storage was cleared.
		if (browser) {
			addEventListener('storage', (event) => {
				if (event.key === KEY || event.key === null) this.list = read();
			});
		}
	}

	private save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.list));
		} catch {
			// Not stored: the list still works until the page closes.
		}
	}

	has(place: Coordinates) {
		return this.list.some((p) => same(p, place));
	}

	add(place: SavedPlace) {
		if (this.has(place)) return;
		this.list = [place, ...this.list].slice(0, MAX_PLACES);
		this.save();
	}

	remove(index: number): SavedPlace | undefined {
		const [removed] = this.list.splice(index, 1);
		this.save();
		return removed;
	}

	insert(index: number, place: SavedPlace) {
		this.list.splice(index, 0, place);
		this.save();
	}

	rename(index: number, name: string) {
		const trimmed = name.trim().slice(0, 80);
		if (!trimmed || !this.list[index]) return;
		this.list[index].name = trimmed;
		this.save();
	}

	move(index: number, by: -1 | 1) {
		const target = index + by;
		if (target < 0 || target >= this.list.length) return;
		[this.list[index], this.list[target]] = [this.list[target], this.list[index]];
		this.save();
	}
}

export const savedPlaces = new SavedPlaces();

export function rememberLastPlace(place: SavedPlace) {
	const value = encodeURIComponent(`${formatCoordinates(place)}|${place.name}`);
	document.cookie = `${LAST_PLACE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/** Reads the last-place cookie on the server: "48.15,17.11|Bratislava". */
export function parseLastPlace(value: string | undefined): { coords: string; name: string } | null {
	if (!value) return null;
	const [coords, name] = value.split('|');
	if (!coords || !name || !/^-?[\d.]+,-?[\d.]+$/.test(coords)) return null;
	return { coords, name: name.slice(0, 80) };
}
