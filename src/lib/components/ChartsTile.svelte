<script lang="ts">
	import { ChartLine, Sun, Wind } from '@lucide/svelte';
	import { strongestGust, sunHours } from '#lib/charts.js';
	import { uvLevel, type Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Hour } from '#lib/weather.js';

	// Wind and gusts over the next 24 hours, and UV through the daylight hours (U-24). Plain SVG
	// like the temperature chart: the answer lines say it in words and the table holds every value.
	let { hours, f }: { hours: Hour[]; f: Formatter } = $props();

	const STEP = 10;
	const HEIGHT = 60;
	const width = $derived((hours.length - 1) * STEP);
	const top = $derived(Math.max(10, ...hours.map((h) => h.gust)) * 1.1);
	const y = (kmh: number) => HEIGHT - (kmh / top) * (HEIGHT - 4);
	const line = (pick: (h: Hour) => number) =>
		hours.map((h, i) => `${i ? 'L' : 'M'}${i * STEP},${y(pick(h)).toFixed(1)}`).join('');
	const gustArea = $derived(`${line((h) => h.gust)}L${width},${HEIGHT}L0,${HEIGHT}Z`);
	const gust = $derived(strongestGust(hours));
	const ticks = $derived(hours.filter((_, i) => i % 6 === 0));

	const sun = $derived(sunHours(hours));
	const uvTop = $derived(Math.max(8, sun?.peak.uv ?? 0));
	// The WHO bands, as in today's details.
	const uvFill = (uv: number) =>
		({
			low: 'fill-good',
			moderate: 'fill-sun',
			high: 'fill-warm',
			veryHigh: 'fill-rose',
			extreme: 'fill-rose'
		})[uvLevel(uv)];
	const uvWord = (uv: number) =>
		({
			low: m.uv_low,
			moderate: m.uv_moderate,
			high: m.uv_high,
			veryHigh: m.uv_very_high,
			extreme: m.uv_extreme
		})[uvLevel(uv)]();
</script>

<section class="glass p-6">
	<p class="question"><ChartLine size={18} aria-hidden="true" /> {m.charts_question()}</p>

	{#if gust}
		<h3 class="mt-3 flex items-center gap-1.5 text-sm font-semibold">
			<Wind size={16} aria-hidden="true" />
			{m.wind_speed()}
		</h3>
		<p class="mt-1 answer text-xl!">
			{m.wind_chart_answer({ gust: f.wind(gust.gust), time: f.time(gust.time) })}
		</p>
		<svg
			viewBox="0 0 {width} {HEIGHT}"
			preserveAspectRatio="none"
			class="mt-3 h-24 w-full overflow-visible"
			aria-hidden="true"
		>
			<path d={gustArea} class="fill-rain/15 forced-colors:hidden" />
			<path
				d={line((h) => h.gust)}
				class="fill-none stroke-rain"
				stroke-width="1.5"
				stroke-dasharray="4 4"
				vector-effect="non-scaling-stroke"
			/>
			<path
				d={line((h) => h.wind)}
				class="fill-none stroke-ink"
				stroke-width="2.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
		<div class="relative mt-1 h-4 text-xs text-ink-muted tabular-nums" aria-hidden="true">
			{#each ticks as tick (tick.time)}
				{@const at = hours.indexOf(tick) / Math.max(1, hours.length - 1)}
				<span
					class="absolute whitespace-nowrap"
					style:left="{at * 100}%"
					style:translate={at === 0 ? '0' : at > 0.9 ? '-100%' : '-50%'}
				>
					{f.hour(tick.time)}
				</span>
			{/each}
		</div>
		<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
			<li class="flex items-center gap-1.5">
				<span class="h-0.75 w-5 rounded bg-ink"></span>{m.wind_line()}
			</li>
			<li class="flex items-center gap-1.5">
				<span class="w-5 border-t-2 border-dashed border-rain"></span>{m.gust_line()}
			</li>
		</ul>
	{/if}

	<h3 class="mt-5 flex items-center gap-1.5 text-sm font-semibold">
		<Sun size={16} aria-hidden="true" />
		{m.uv_index()}
	</h3>
	{#if sun}
		<p class="mt-1 answer text-xl!">
			{m.uv_chart_answer({
				uv: Math.round(sun.peak.uv),
				level: uvWord(sun.peak.uv),
				time: f.time(sun.peak.time)
			})}
		</p>
		<svg
			viewBox="0 0 {sun.hours.length * 10} 40"
			preserveAspectRatio="none"
			class="mt-3 h-16 w-full"
			aria-hidden="true"
		>
			{#each sun.hours as hour, i (hour.time)}
				{@const height = Math.max(0.75, (hour.uv / uvTop) * 40)}
				<rect
					x={i * 10 + 1.5}
					y={40 - height}
					width="7"
					{height}
					rx="1.5"
					class="{uvFill(hour.uv)} forced-color-adjust-none forced-colors:fill-[CanvasText]"
				/>
			{/each}
		</svg>
		<div class="mt-1 flex justify-between text-xs text-ink-muted tabular-nums" aria-hidden="true">
			<span>{f.hour(sun.hours[0].time)}</span>
			<span>{f.hour(sun.hours.at(-1)!.time)}</span>
		</div>
	{:else}
		<p class="mt-1 text-ink-muted">{m.uv_chart_none()}</p>
	{/if}

	<details class="mt-3">
		<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold">
			{m.show_table()}
		</summary>
		<!-- Scrolls, so it takes a tab stop for keyboards to scroll it, as the hourly strip does. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			tabindex="0"
			role="region"
			aria-label={m.charts_question()}
			class="max-h-72 overflow-y-auto rounded-lg focus-visible:outline-2 focus-visible:outline-veil"
		>
			<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
				<thead class="text-left text-ink-muted">
					<tr>
						<th scope="col" class="py-1 font-medium">{m.hour()}</th>
						<th scope="col" class="py-1 font-medium">{m.wind_line()}</th>
						<th scope="col" class="py-1 font-medium">{m.gust_line()}</th>
						<th scope="col" class="py-1 font-medium">{m.uv_index()}</th>
					</tr>
				</thead>
				<tbody>
					{#each hours as hour (hour.time)}
						<tr class="border-t border-veil/10">
							<th scope="row" class="py-1 text-left font-medium">{f.time(hour.time)}</th>
							<td>{f.wind(hour.wind)}</td>
							<td>{f.wind(hour.gust)}</td>
							<td>{Math.round(hour.uv)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</section>
