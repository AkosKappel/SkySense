<script lang="ts">
	import { Thermometer } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Hour } from '#lib/weather.js';

	// Plain SVG: a linear scale is one line, so no chart library (U-04). The SVG is decoration;
	// the answer line says the same in words and the table holds every value.
	let { hours, f }: { hours: Hour[]; f: Formatter } = $props();

	const STEP = 10;
	const HEIGHT = 100;
	const width = $derived((hours.length - 1) * STEP);

	const values = $derived(hours.flatMap((h) => [h.temp, h.feels]));
	const low = $derived(Math.min(...values) - 1);
	const high = $derived(Math.max(...values) + 1);
	// Temperatures use the top 70%; rain bars sit in the bottom 30%.
	const y = (temp: number) => 5 + (1 - (temp - low) / (high - low)) * 60;
	const line = (pick: (h: Hour) => number) =>
		hours.map((h, i) => `${i ? 'L' : 'M'}${i * STEP},${y(pick(h)).toFixed(1)}`).join('');

	const warmest = $derived(hours.reduce((a, b) => (b.temp > a.temp ? b : a)));
	const coldest = $derived(hours.reduce((a, b) => (b.temp < a.temp ? b : a)));
	const ticks = $derived(hours.filter((_, i) => i % 6 === 0));
</script>

<p class="question"><Thermometer size={18} aria-hidden="true" /> {m.temp_question()}</p>
<p class="mt-2 answer">
	{m.temp_answer({
		max: f.temp(warmest.temp),
		maxTime: f.time(warmest.time),
		min: f.temp(coldest.temp),
		minTime: f.time(coldest.time)
	})}
</p>

<svg
	viewBox="0 0 {width} {HEIGHT}"
	preserveAspectRatio="none"
	class="mt-4 h-36 w-full overflow-visible"
	aria-hidden="true"
>
	{#each hours as hour, i (hour.time)}
		<rect
			x={i * STEP - 3}
			y={HEIGHT - hour.rainChance * 0.3}
			width="6"
			height={hour.rainChance * 0.3}
			class="fill-rain/50"
		/>
	{/each}
	<path
		d={line((h) => h.feels)}
		class="fill-none stroke-ink-muted"
		stroke-width="1.5"
		stroke-dasharray="4 4"
		vector-effect="non-scaling-stroke"
	/>
	<path
		d={line((h) => h.temp)}
		class="fill-none stroke-sun"
		stroke-width="3"
		stroke-linejoin="round"
		vector-effect="non-scaling-stroke"
	/>
</svg>
<div class="mt-1 flex justify-between text-xs text-ink-muted tabular-nums" aria-hidden="true">
	{#each ticks as tick (tick.time)}<span>{f.hour(tick.time)}</span>{/each}
</div>

<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
	<li class="flex items-center gap-1.5">
		<span class="h-0.75 w-5 rounded bg-sun"></span>{m.temperature_line()}
	</li>
	<li class="flex items-center gap-1.5">
		<span class="w-5 border-t-2 border-dashed border-ink-muted"></span>{m.feels_like_line()}
	</li>
	<li class="flex items-center gap-1.5">
		<span class="h-3 w-2 bg-rain/50"></span>{m.rain_chance_label()}
	</li>
</ul>

<details class="mt-3">
	<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold"
		>{m.show_table()}</summary
	>
	<div class="max-h-72 overflow-y-auto">
		<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
			<thead class="text-left text-ink-muted">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.hour()}</th>
					<th scope="col" class="py-1 font-medium">{m.temperature_line()}</th>
					<th scope="col" class="py-1 font-medium">{m.feels_like_line()}</th>
					<th scope="col" class="py-1 font-medium">{m.rain_chance_label()}</th>
				</tr>
			</thead>
			<tbody>
				{#each hours as hour (hour.time)}
					<tr class="border-t border-white/10">
						<th scope="row" class="py-1 text-left font-medium">{f.time(hour.time)}</th>
						<td>{f.temp(hour.temp)}</td>
						<td>{f.temp(hour.feels)}</td>
						<td>{f.percent(hour.rainChance)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</details>
