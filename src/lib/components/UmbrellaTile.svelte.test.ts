import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatter } from '#lib/format.js';
import { metric } from '#lib/units.js';
import type { Hour } from '#lib/weather.js';
import UmbrellaTile from './UmbrellaTile.svelte';

const f = formatter('en', metric);

const hours = (chances: number[], wet: Hour['condition'] = 'rain'): Hour[] =>
	chances.map((rainChance, i) => ({
		time: `2026-11-10T${String(8 + i).padStart(2, '0')}:00`,
		temp: 8,
		feels: 6,
		condition: rainChance >= 50 ? wet : 'cloudy',
		isDay: true,
		rainChance,
		rain: 0,
		wind: 10,
		gust: 20,
		uv: 1
	}));

describe('UmbrellaTile', () => {
	it('says no when no hour is likely to be wet', async () => {
		const screen = render(UmbrellaTile, { hours: hours([10, 20, 30]), f });
		await expect.element(screen.getByText('No, it should stay dry.')).toBeVisible();
	});

	it('says when rain goes on past the hours shown', async () => {
		const screen = render(UmbrellaTile, { hours: hours([10, 10, 70, 80]), f, fromNow: false });
		await expect.element(screen.getByText('Yes, from 10:00 on.')).toBeVisible();
	});

	it('says all day when every hour is wet', async () => {
		const screen = render(UmbrellaTile, { hours: hours([70, 80, 90]), f });
		await expect.element(screen.getByText('Yes, all day.')).toBeVisible();
	});

	it('says when rain that is falling stops', async () => {
		const screen = render(UmbrellaTile, { hours: hours([90, 80, 10]), f });
		await expect.element(screen.getByText('Yes, until 10:00.')).toBeVisible();
	});

	it('says when rain starts and stops', async () => {
		const screen = render(UmbrellaTile, { hours: hours([10, 10, 70, 60, 20]), f });
		await expect.element(screen.getByText('Yes, from 10:00 to 12:00.')).toBeVisible();
	});

	it('says when it snows instead', async () => {
		const screen = render(UmbrellaTile, { hours: hours([10, 80, 80, 10], 'snow'), f });
		await expect.element(screen.getByText('Not rain but snow, from 09:00 to 11:00.')).toBeVisible();
	});

	it('warns about thunderstorms', async () => {
		const screen = render(UmbrellaTile, { hours: hours([70, 10], 'thunder'), f });
		await expect.element(screen.getByText('Yes, with thunderstorms until 09:00.')).toBeVisible();
	});
});
