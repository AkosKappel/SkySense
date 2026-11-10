<script lang="ts">
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day } from '#lib/weather.js';

	let { days, f }: { days: Day[]; f: Formatter } = $props();

	const low = $derived(Math.min(...days.map((d) => d.min)));
	const high = $derived(Math.max(...days.map((d) => d.max)));
	const position = (t: number) => ((t - low) / Math.max(1, high - low)) * 100;
</script>

<ul class="mt-3 divide-y divide-white/10">
	{#each days as day, i (day.date)}
		<li
			class="grid grid-cols-[3.5rem_1.75rem_2.75rem_2.5rem_1fr_2.5rem] items-center gap-2 py-2.5 text-sm"
		>
			<span class="font-semibold">{i === 0 ? m.today() : f.weekday(day.date)}</span>
			<WeatherIcon condition={day.condition} size={20} />
			<span class="text-xs text-rain-soft tabular-nums">
				{#if day.rainChance >= 20}
					<span class="sr-only">{m.rain_chance_label()} </span>{f.percent(day.rainChance)}
				{/if}
			</span>
			<span class="text-right text-ink-muted tabular-nums">
				<span class="sr-only">{m.low()} </span>{f.temp(day.min)}
			</span>
			<span class="relative h-1.5 rounded-full bg-white/10" aria-hidden="true">
				<span
					class="absolute inset-y-0 rounded-full bg-linear-to-r from-cold to-warm"
					style="left: {position(day.min)}%; right: {100 - position(day.max)}%"
				></span>
			</span>
			<span class="font-semibold tabular-nums">
				<span class="sr-only">{m.high()} </span>{f.temp(day.max)}
			</span>
			<span class="sr-only">{conditionLabel(day.condition)}</span>
		</li>
	{/each}
</ul>
