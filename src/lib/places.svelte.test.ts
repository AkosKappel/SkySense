import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PLACES, savedPlaces } from './places.svelte.js';

const place = (i: number) => ({ name: `Place ${i}`, lat: 40 + i, lon: 10 + i });
const stored = () => JSON.parse(localStorage.getItem('skysense.places') ?? '[]');

describe('savedPlaces', () => {
	beforeEach(() => {
		localStorage.clear();
		savedPlaces.list = [];
	});

	it('adds new places first, once, and keeps at most ten', () => {
		for (let i = 0; i < MAX_PLACES + 2; i++) savedPlaces.add(place(i));
		savedPlaces.add(place(11));
		expect(savedPlaces.list).toHaveLength(MAX_PLACES);
		expect(savedPlaces.list[0].name).toBe('Place 11');
		expect(stored()).toHaveLength(MAX_PLACES);
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
