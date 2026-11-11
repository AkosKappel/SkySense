import { describe, expect, it } from 'vitest';
import { isSearchShortcut } from './keys.js';

const key = (init: Partial<KeyboardEvent> & { key: string }, tagName = 'BODY') =>
	({
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		...init,
		target: { tagName }
	}) as unknown as KeyboardEvent;

describe('isSearchShortcut', () => {
	it('takes / outside text fields only', () => {
		expect(isSearchShortcut(key({ key: '/' }))).toBe(true);
		expect(isSearchShortcut(key({ key: '/' }, 'INPUT'))).toBe(false);
		expect(isSearchShortcut(key({ key: '/', ctrlKey: true }))).toBe(false);
	});

	it('takes Ctrl+K and Cmd+K anywhere', () => {
		expect(isSearchShortcut(key({ key: 'k', ctrlKey: true }))).toBe(true);
		expect(isSearchShortcut(key({ key: 'K', metaKey: true }, 'INPUT'))).toBe(true);
		expect(isSearchShortcut(key({ key: 'k' }))).toBe(false);
		expect(isSearchShortcut(key({ key: 'k', ctrlKey: true, altKey: true }))).toBe(false);
	});
});
