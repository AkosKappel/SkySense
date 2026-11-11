import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatter } from '#lib/format.js';
import { metric } from '#lib/units.js';
import type { Day, Hour } from '#lib/weather.js';
import ActivityTile from './ActivityTile.svelte';

const f = formatter('en', metric);
const day: Day = {
	date: '2026-11-12',
	condition: 'cloudy',
	max: 2,
	min: -4,
	rainChance: 0,
	rain: 0,
	sunrise: '2026-11-12T06:53',
	sunset: '2026-11-12T16:17',
	uvMax: 1
};
const hours = (feels: number): Hour[] =>
	Array.from({ length: 24 }, (_, h) => ({
		time: `2026-11-12T${String(h).padStart(2, '0')}:00`,
		temp: feels,
		feels,
		condition: 'cloudy',
		isDay: h >= 7 && h < 16,
		rainChance: 0,
		rain: 0,
		wind: 5,
		gust: 10,
		uv: 1
	}));

describe('ActivityTile', () => {
	beforeEach(() => localStorage.clear());

	it('says "that day" in a day view and "in the next 24 hours" on the overview', async () => {
		const dayView = render(ActivityTile, { hours: hours(-30), days: [day], f, scope: 'day' });
		await expect.element(dayView.getByText('Too cold that day.').first()).toBeVisible();
		dayView.unmount();

		const overview = render(ActivityTile, { hours: hours(-30), days: [day], f });
		await expect
			.element(overview.getByText('Too cold in the next 24 hours.').first())
			.toBeVisible();
	});

	it('shows a good time with its badge', async () => {
		const screen = render(ActivityTile, { hours: hours(12), days: [day], f });
		await expect
			.element(screen.getByRole('listitem').filter({ hasText: 'Run' }))
			.toHaveTextContent(/07:00 to 08:00.*Great/);
	});
});
