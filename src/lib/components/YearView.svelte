<script lang="ts">
	import { ArrowLeft, CalendarRange, Droplets, Snowflake, Sun, Wind } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { RAIN_DAY_MM, type YearInWeather } from '#lib/year.js';

	let { year, place, f }: { year: YearInWeather | null; place: string; f: Formatter } = $props();

	const wettestMonth = $derived(year ? Math.max(1, ...year.months.map((mo) => mo.rain)) : 1);
	const records = $derived(
		year
			? [
					{
						icon: Sun,
						label: m.year_warmest(),
						value: f.temp(year.warmest.value),
						date: year.warmest.date
					},
					{
						icon: Snowflake,
						label: m.year_coldest(),
						value: f.temp(year.coldest.value),
						date: year.coldest.date
					},
					{
						icon: Droplets,
						label: m.year_wettest(),
						value: f.rain(year.wettest.value),
						date: year.wettest.date
					},
					{
						icon: Wind,
						label: m.year_windiest(),
						value: f.wind(year.windiest.value),
						date: year.windiest.date
					}
				]
			: []
	);
</script>

<div class="mt-5 flex items-center gap-3">
	<a
		href={resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})}
		aria-label={m.back_to_forecast()}
		class="grid size-11 shrink-0 pill place-items-center"
	>
		<ArrowLeft size={18} aria-hidden="true" />
	</a>
	<h1 class="text-2xl font-extrabold">{m.year_title({ place })}</h1>
</div>

{#if !year}
	<p class="mt-4 glass p-6">{m.year_unavailable()}</p>
{:else}
	<p class="mt-3 px-1 text-ink-muted">
		{m.year_range({ from: f.pastDate(year.from), until: f.pastDate(year.until) })}
	</p>

	<dl class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each records as record (record.label)}
			{@const Icon = record.icon}
			<div class="glass p-5">
				<dt class="flex items-center gap-1.5 text-sm text-ink-muted">
					<Icon size={16} aria-hidden="true" />
					{record.label}
				</dt>
				<dd class="mt-1">
					<span class="block text-3xl font-bold tabular-nums">{record.value}</span>
					<span class="text-sm text-ink-muted">{f.pastDate(record.date)}</span>
				</dd>
			</div>
		{/each}
	</dl>

	<section class="mt-4 glass p-6">
		<p class="question"><CalendarRange size={18} aria-hidden="true" /> {m.year_question()}</p>
		<p class="mt-2 text-lg font-semibold">
			{m.year_rain_answer({
				rain: f.rain(year.rain),
				days: year.rainDays,
				threshold: f.rain(RAIN_DAY_MM)
			})}
		</p>

		<div class="mt-4 grid grid-cols-12 items-end gap-1" aria-hidden="true">
			{#each year.months as month (month.month)}
				<div class="flex flex-col items-center gap-1">
					<span class="text-[11px] font-semibold tabular-nums">{f.temp(month.meanMax)}</span>
					<div class="flex h-24 w-full items-end">
						<div
							class="w-full rounded-t-sm bg-rain/70 forced-color-adjust-none forced-colors:bg-[CanvasText]"
							style:height="{Math.max(2, (month.rain / wettestMonth) * 100)}%"
						></div>
					</div>
					<span class="text-[11px] text-ink-muted">{f.month(month.month)}</span>
				</div>
			{/each}
		</div>

		<p class="mt-2 text-sm text-ink-muted">{m.year_chart_note()}</p>
		<details class="mt-3">
			<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold"
				>{m.show_table()}</summary
			>
			<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
				<thead class="text-left text-ink-muted">
					<tr>
						<th scope="col" class="py-1 font-medium">{m.year_month()}</th>
						<th scope="col" class="py-1 font-medium">{m.year_mean_max()}</th>
						<th scope="col" class="py-1 font-medium">{m.rain_amount()}</th>
						<th scope="col" class="py-1 font-medium">{m.year_rain_days()}</th>
					</tr>
				</thead>
				<tbody>
					{#each year.months as month (month.month)}
						<tr class="border-t border-veil/10">
							<th scope="row" class="py-1 text-left font-medium">{f.month(month.month, true)}</th>
							<td>{f.temp(month.meanMax)}</td>
							<td>{f.rain(month.rain)}</td>
							<td>{month.rainDays}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</details>
	</section>
{/if}
