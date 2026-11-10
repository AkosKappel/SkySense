import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import PlaceSearch from './PlaceSearch.svelte';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));

const places = [
	{ id: 1, name: 'Bratislava', detail: 'Bratislavský, Slovensko', lat: 48.148, lon: 17.107 },
	{ id: 2, name: 'Bratislava - Rača', detail: 'Bratislavský, Slovensko', lat: 48.2, lon: 17.15 }
];

function answer(response: Response) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => response)
	);
}

describe('PlaceSearch', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => {
		vi.unstubAllGlobals();
		goto.mockReset();
	});

	it('lists matches and opens the chosen place with the keyboard', async () => {
		answer(Response.json(places));
		const screen = render(PlaceSearch);
		const field = screen.getByRole('combobox', { name: 'Search for a place' });

		await field.fill('Bratisl');
		await expect.element(screen.getByRole('option', { name: /Rača/ })).toBeVisible();
		await expect
			.element(screen.getByRole('option').first())
			.toHaveAttribute('aria-selected', 'true');

		await userEvent.keyboard('{ArrowDown}');
		await expect
			.element(screen.getByRole('option', { name: /Rača/ }))
			.toHaveAttribute('aria-selected', 'true');
		await userEvent.keyboard('{Enter}');

		expect(goto).toHaveBeenCalledWith('/p/48.2,17.15/Bratislava%20-%20Ra%C4%8Da');
		expect(JSON.parse(localStorage.getItem('skysense.places') ?? '[]')[0].name).toBe(
			'Bratislava - Rača'
		);
	});

	it('asks in the current language and closes on Escape', async () => {
		answer(Response.json(places));
		const screen = render(PlaceSearch);
		await screen.getByRole('combobox').fill('Bratisl');
		await expect.element(screen.getByRole('listbox')).toBeVisible();
		expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('lang=en');

		await userEvent.keyboard('{Escape}');
		await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument();
	});

	it('says when nothing matches', async () => {
		answer(Response.json([]));
		const screen = render(PlaceSearch);
		await screen.getByRole('combobox').fill('Qqqq');
		await expect.element(screen.getByText('No places found for “Qqqq”.')).toBeVisible();
	});

	it('says when search is unavailable', async () => {
		answer(new Response('down', { status: 502 }));
		const screen = render(PlaceSearch);
		await screen.getByRole('combobox').fill('Bratisl');
		await expect.element(screen.getByText("Place search isn't available right now.")).toBeVisible();
	});

	it('does not search for a single letter', async () => {
		answer(Response.json(places));
		const screen = render(PlaceSearch);
		await screen.getByRole('combobox').fill('B');
		await new Promise((done) => setTimeout(done, 400));
		expect(fetch).not.toHaveBeenCalled();
	});
});
