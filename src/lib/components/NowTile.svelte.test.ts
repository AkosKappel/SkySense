import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { formatter } from '#lib/format.js';
import { metric } from '#lib/units.js';
import type { Current, Day, Hour } from '#lib/weather.js';
import NowTile from './NowTile.svelte';

const f = formatter('en', metric);
const now: Current = {
	time: '2026-11-10T10:00',
	temp: 6,
	feels: 3,
	condition: 'rain',
	isDay: true,
	wind: 12,
	gust: 27,
	windDirection: 90,
	humidity: 95
};
const hours: Hour[] = [10, 11, 12].map((h, i) => ({
	time: `2026-11-10T${h}:00`,
	temp: 6 + i * 3,
	feels: 3 + i,
	condition: i === 2 ? 'clear' : 'rain',
	isDay: true,
	rainChance: 0,
	rain: 0,
	wind: 10,
	gust: 20,
	uv: 1
}));
const days = [{ date: '2026-11-10', max: 13, min: 4 } as Day];

describe('NowTile', () => {
	it('shows the hour under the scrubber and goes back to now', async () => {
		const screen = render(NowTile, { now, hours, days, f, updated: null });
		const slider = screen.getByRole('slider', { name: 'Look ahead' });
		await expect.element(screen.getByText('Now · Tue 10:00')).toBeVisible();

		await slider.click();
		await userEvent.keyboard('{End}');
		await expect.element(screen.getByText('At Tue 12:00')).toBeVisible();
		await expect.element(screen.getByText('12°')).toBeVisible();
		await expect.element(slider).toHaveAttribute('aria-valuetext', 'Tue 12:00, 12°, Sunny');

		await screen.getByRole('button', { name: 'Back to now' }).click();
		await expect.element(screen.getByText('Now · Tue 10:00')).toBeVisible();
		await expect.element(screen.getByText('6°')).toBeVisible();
	});
});
