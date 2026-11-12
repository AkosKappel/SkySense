import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatter } from '#lib/format.js';
import { metric } from '#lib/units.js';
import type { Day, Hour } from '#lib/weather.js';
import DailyList from './DailyList.svelte';

vi.mock('$app/state', () => ({ page: { params: { coords: '48.15,17.11', name: 'Bratislava' } } }));
vi.mock('$app/paths', () => ({
	resolve: (_: string, params: { coords: string; name: string }) =>
		`/p/${params.coords}/${params.name}`
}));

const f = formatter('en', metric);
const day = (date: string, extra: Partial<Day> = {}): Day => ({
	date,
	condition: 'rain',
	max: 9,
	min: 3,
	rainChance: 80,
	rain: 4,
	sunrise: `${date}T06:50`,
	sunset: `${date}T16:19`,
	uvMax: 1,
	...extra
});
const hours = (date: string, width: number): Hour[] =>
	Array.from({ length: 24 }, (_, i) => ({
		time: `${date}T${String(i).padStart(2, '0')}:00`,
		temp: 6,
		feels: 4,
		condition: 'cloudy',
		isDay: true,
		rainChance: 0,
		rain: 0,
		wind: 5,
		gust: 10,
		uv: 1,
		spread: { low: 6 - width / 2, high: 6 + width / 2, rain: 0 }
	}));

describe('DailyList', () => {
	const days = [day('2026-11-10'), day('2026-11-11', { rainChance: 10, condition: 'clear' })];

	it('reads each day out with its low, high, rain chance and condition', async () => {
		const screen = await render(DailyList, {
			days,
			hours: [...hours('2026-11-10', 1), ...hours('2026-11-11', 1)],
			f
		});
		const today = screen.getByRole('link', { name: /Today/ });
		await expect
			.element(today)
			.toHaveAccessibleName('Today Chance of rain 80% Low 3° High 9° Rain');
		await expect.element(today).toHaveAttribute('href', '/p/48.15,17.11/Bratislava?day=2026-11-10');
		// Below 20% the chance is left out, so a dry day is not read as a rainy one.
		await expect
			.element(screen.getByRole('link', { name: /Wed/ }))
			.not.toHaveAccessibleName(/Chance/);
	});

	it('marks the days the model runs disagree on, and explains the mark', async () => {
		const screen = await render(DailyList, {
			days,
			hours: [...hours('2026-11-10', 1), ...hours('2026-11-11', 8)],
			f
		});
		await expect.element(screen.getByText('Uncertain', { exact: true })).toBeVisible();
		await expect.element(screen.getByText(/51 runs of the ECMWF weather model/)).toBeVisible();
	});

	it('says nothing about confidence when every day is sure', async () => {
		const screen = await render(DailyList, { days, hours: hours('2026-11-10', 1), f });
		expect(screen.container.textContent).not.toContain('51 runs');
	});
});
