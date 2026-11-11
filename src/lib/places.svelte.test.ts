import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PLACES, placeKey, savedPlaces } from './places.svelte.js';

const place = (i: number) => ({ name: `Place ${i}`, lat: 40 + i, lon: 10 + i });
const stored = () => JSON.parse(localStorage.getItem('skysense.places') ?? '[]');

describe('savedPlaces', () => {
	beforeEach(() => {
		localStorage.clear();
		savedPlaces.list = [];
	});

	it('adds new places first, once, and refuses an eleventh rather than drop one', () => {
		for (let i = 0; i < MAX_PLACES; i++) expect(savedPlaces.add(place(i))).toBe(true);
		expect(savedPlaces.add(place(0))).toBe(true);
		expect(savedPlaces.add(place(11))).toBe(false);
		expect(savedPlaces.list).toHaveLength(MAX_PLACES);
		expect(savedPlaces.list[0].name).toBe(`Place ${MAX_PLACES - 1}`);
		expect(stored()).toHaveLength(MAX_PLACES);
		// "My location" does not count against the limit and drops nothing either.
		savedPlaces.setLive({ name: 'My location', lat: 1, lon: 1 });
		expect(savedPlaces.list).toHaveLength(MAX_PLACES + 1);
	});

	it('keeps "My location" and a saved place at the same coordinates apart', () => {
		savedPlaces.add({ name: 'Bratislava', lat: 48.148, lon: 17.107 });
		savedPlaces.setLive({ name: 'My location', lat: 48.152, lon: 17.11 });
		expect(savedPlaces.list.map(placeKey)).toEqual(['live', '48.15,17.11']);
	});

	it('drops repeated entries found in storage', () => {
		localStorage.setItem('skysense.places', JSON.stringify([place(1), place(1), place(2)]));
		dispatchEvent(new StorageEvent('storage', { key: 'skysense.places' }));
		expect(savedPlaces.list.map((p) => p.name)).toEqual(['Place 1', 'Place 2']);
	});

	it('renames with a trimmed name and ignores an empty one', () => {
		savedPlaces.add(place(1));
		savedPlaces.rename(0, '  Home  ');
		savedPlaces.rename(0, '   ');
		expect(savedPlaces.list[0].name).toBe('Home');
		expect(stored()[0].name).toBe('Home');
	});

	it('moves within the list and not past its ends', () => {
		savedPlaces.add(place(2));
		savedPlaces.add(place(1));
		savedPlaces.move(0, 1);
		expect(savedPlaces.list.map((p) => p.name)).toEqual(['Place 2', 'Place 1']);
		savedPlaces.move(1, 1);
		expect(savedPlaces.list.map((p) => p.name)).toEqual(['Place 2', 'Place 1']);
	});

	it('picks up changes another tab made', async () => {
		localStorage.setItem('skysense.places', JSON.stringify([place(7)]));
		dispatchEvent(new StorageEvent('storage', { key: 'skysense.places' }));
		expect(savedPlaces.list.map((p) => p.name)).toEqual(['Place 7']);
	});

	it('skips damaged entries in storage', () => {
		localStorage.setItem('skysense.places', JSON.stringify([place(1), { name: 3 }, 'x']));
		dispatchEvent(new StorageEvent('storage', { key: 'skysense.places' }));
		expect(savedPlaces.list).toHaveLength(1);
	});

	it('keeps one "My location" entry, first, with the latest position', () => {
		savedPlaces.add(place(1));
		savedPlaces.setLive({ name: 'My location', lat: 48.15, lon: 17.11 });
		savedPlaces.setLive({ name: 'My location', lat: 40.42, lon: -3.7 });
		expect(savedPlaces.list.filter((p) => p.live)).toEqual([
			{ name: 'My location', lat: 40.42, lon: -3.7, live: true }
		]);
		expect(savedPlaces.list[0].live).toBe(true);
		expect(savedPlaces.list).toHaveLength(2);
	});
});
