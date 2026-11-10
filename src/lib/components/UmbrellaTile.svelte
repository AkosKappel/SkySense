<script lang="ts">
	import { Umbrella } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { nextRain, RAIN_LIKELY, type Hour } from '#lib/weather.js';

	let { hours, f }: { hours: Hour[]; f: Formatter } = $props();

	const rain = $derived(nextRain(hours));
	const day = $derived(hours.slice(0, 24));
	const answer = $derived(
		!rain
			? m.umbrella_no()
			: rain.startsNow
				? m.umbrella_until({ until: f.time(rain.until) })
				: m.umbrella_from({ from: f.time(rain.from), until: f.time(rain.until) })
	);
</script>

<p class="question"><Umbrella size={18} aria-hidden="true" /> {m.umbrella_question()}</p>
<p class="mt-2 answer">{answer}</p>
<div class="mt-4 flex items-end gap-0.5" aria-hidden="true">
	{#each day as hour, i (hour.time)}
		<div class="flex flex-1 flex-col items-center gap-1">
			<div
				class="w-full rounded-sm bg-rain"
				style="height: {Math.max(3, hour.rainChance * 0.5)}px; opacity: {hour.rainChance >=
				RAIN_LIKELY
					? 1
					: 0.35}"
			></div>
			<span class="h-4 text-[11px] font-semibold text-ink-muted"
				>{i % 6 === 0 ? (i === 0 ? m.now() : f.hour(hour.time)) : ''}</span
			>
		</div>
	{/each}
</div>
