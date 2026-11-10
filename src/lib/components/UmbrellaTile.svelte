<script lang="ts">
	import { Umbrella } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { nextRain, RAIN_LIKELY, type Hour } from '#lib/weather.js';

	let {
		hours,
		f,
		fromNow = true
	}: {
		hours: Hour[];
		f: Formatter;
		/** False for a later day: no "Now" label, no "until". */ fromNow?: boolean;
	} = $props();

	const rain = $derived(nextRain(hours));
	const day = $derived(hours.slice(0, 24));
	// Whole sentences per kind, so every language can phrase "snow instead of rain" its own way.
	const sentences = {
		rain: {
			fromTo: m.umbrella_from,
			until: m.umbrella_until,
			fromOn: m.umbrella_from_on,
			allDay: m.umbrella_all_day
		},
		snow: {
			fromTo: m.umbrella_snow_from,
			until: m.umbrella_snow_until,
			fromOn: m.umbrella_snow_from_on,
			allDay: m.umbrella_snow_all_day
		},
		mixed: {
			fromTo: m.umbrella_mixed_from,
			until: m.umbrella_mixed_until,
			fromOn: m.umbrella_mixed_from_on,
			allDay: m.umbrella_mixed_all_day
		},
		thunder: {
			fromTo: m.umbrella_thunder_from,
			until: m.umbrella_thunder_until,
			fromOn: m.umbrella_thunder_from_on,
			allDay: m.umbrella_thunder_all_day
		}
	} as const;

	const answer = $derived.by(() => {
		if (!rain) return m.umbrella_no();
		const say = sentences[rain.kind];
		const from = f.time(rain.from);
		const until = f.time(rain.until);
		if (rain.startsNow && rain.openEnded) return say.allDay();
		if (rain.openEnded) return say.fromOn({ from });
		if (rain.startsNow && fromNow) return say.until({ until });
		return say.fromTo({ from, until });
	});
</script>

<p class="question"><Umbrella size={18} aria-hidden="true" /> {m.umbrella_question()}</p>
<p class="mt-2 answer">{answer}</p>
<div class="mt-4 flex items-end gap-0.5" aria-hidden="true">
	{#each day as hour, i (hour.time)}
		<div class="flex flex-1 flex-col items-center gap-1">
			<div
				class="w-full rounded-sm {hour.condition === 'snow' ? 'bg-ink' : 'bg-rain'}"
				style="height: {Math.max(3, hour.rainChance * 0.5)}px; opacity: {hour.rainChance >=
				RAIN_LIKELY
					? 1
					: 0.35}"
			></div>
			<span class="h-4 text-[11px] font-semibold text-ink-muted"
				>{i % 6 === 0 ? (i === 0 && fromNow ? m.now() : f.hour(hour.time)) : ''}</span
			>
		</div>
	{/each}
</div>
