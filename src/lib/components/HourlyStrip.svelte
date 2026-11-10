<script lang="ts">
	import { Droplets } from '@lucide/svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Hour } from '#lib/weather.js';

	let { hours, f }: { hours: Hour[]; f: Formatter } = $props();
</script>

<!-- Focusable so keyboard users can scroll the strip (axe: scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	role="region"
	aria-label={m.next_hours()}
	tabindex="0"
	class="-mx-2 mt-3 overflow-x-auto rounded-2xl px-1 pb-2"
>
	<ol class="flex gap-1">
		{#each hours as hour, i (hour.time)}
			<li
				class="relative flex min-w-15 flex-col items-center gap-2 rounded-2xl px-1 py-3 {i === 0
					? 'bg-white/15 outline-1 outline-white/25'
					: ''}"
			>
				<span class="text-xs font-medium text-ink-muted"
					>{i === 0 ? m.now() : f.hour(hour.time)}</span
				>
				<WeatherIcon condition={hour.condition} isDay={hour.isDay} />
				<span class="sr-only">{conditionLabel(hour.condition, hour.isDay)}</span>
				<span class="font-semibold tabular-nums">{f.temp(hour.temp)}</span>
				<span
					class="flex items-center gap-0.5 text-xs text-rain-soft tabular-nums {hour.rainChance < 20
						? 'invisible'
						: ''}"
				>
					<Droplets size={11} aria-hidden="true" />
					<span class="sr-only">{m.rain_chance_label()}</span>
					{f.percent(hour.rainChance)}
				</span>
			</li>
		{/each}
	</ol>
</div>
