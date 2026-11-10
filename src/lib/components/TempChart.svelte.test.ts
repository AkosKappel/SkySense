import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatter } from '#lib/format.js';
import { metric } from '#lib/units.js';
import type { Hour } from '#lib/weather.js';
import TempChart from './TempChart.svelte';

const f = formatter('en', metric);
const hours: Hour[] = [4, 9, 12, 7].map((temp, i) => ({
	time: `2026-11-10T${String(10 + i)}:00`,
	temp,
	feels: temp - 2,
	condition: 'cloudy',
	isDay: true,
	rainChance: i * 20,
	rain: 0,
	wind: 10,
	gust: 20,
	uv: 1
}));

describe('TempChart', () => {
	it('says the warmest and coldest hour in words', async () => {
		const screen = render(TempChart, { hours, f });
		await expect
			.element(screen.getByText('Warmest 12° at 12:00, coldest 4° at 10:00.'))
			.toBeVisible();
	});

	it('has every value in a table', async () => {
		const screen = render(TempChart, { hours, f });
		await screen.getByText('Show as a table').click();
		const row = screen.getByRole('row', { name: /13:00/ });
		await expect.element(row).toHaveTextContent('13:007°5°60%');
	});

	it('shows the likely range when the ensemble covers every hour', async () => {
		const withSpread = hours.map((h) => ({
			...h,
			spread: { low: h.temp - 1, high: h.temp + 2, rain: 0 }
		}));
		const screen = render(TempChart, { hours: withSpread, f });
		await screen.getByText('Show as a table').click();
		await expect
			.element(screen.getByRole('row', { name: /13:00/ }))
			.toHaveTextContent('13:007°5°6° to 9°60%');
		await expect.element(screen.getByText('Likely range').first()).toBeInTheDocument();
	});
});
