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
// The test browser's own offset, so a place can be put in the same zone or hours away from it.
const here = -new Date().getTimezoneOffset() * 60;
const props = { now, hours, days, f, updated: null, place: 'Tokyo', utcOffsetSeconds: here };

describe('NowTile', () => {
	it('shows the hour under the scrubber and goes back to now', async () => {
		const screen = await render(NowTile, props);
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

	it('says how far ahead or behind the place is, only when it differs', async () => {
		const ahead = await render(NowTile, { ...props, utcOffsetSeconds: here + 8 * 3600 });
		await expect
			.element(ahead.getByText('Local time in Tokyo, 8 hours ahead of you.'))
			.toBeVisible();
		ahead.unmount();

		const behind = await render(NowTile, { ...props, utcOffsetSeconds: here - 3600 });
		await expect.element(behind.getByText('Local time in Tokyo, 1 hour behind you.')).toBeVisible();
		behind.unmount();

		const same = await render(NowTile, props);
		await expect.element(same.getByText('Now · Tue 10:00')).toBeVisible();
		expect(same.container.textContent).not.toContain('Local time');
	});

	it('says what to wear, with the extras', async () => {
		const screen = await render(NowTile, { ...props, wear: { layer: 'warm', extras: ['rain'] } });
		await expect
			.element(screen.getByText('A warm jacket. Something waterproof too.'))
			.toBeVisible();
	});
});
