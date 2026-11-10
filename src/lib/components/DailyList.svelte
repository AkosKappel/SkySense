<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { dayConfidence } from '#lib/confidence.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day, Hour } from '#lib/weather.js';

	let { days, hours, f }: { days: Day[]; hours: Hour[]; f: Formatter } = $props();

	const low = $derived(Math.min(...days.map((d) => d.min)));
	const high = $derived(Math.max(...days.map((d) => d.max)));
	const confidence = $derived(
		days.map((d) => dayConfidence(hours.filter((h) => h.time.startsWith(d.date))))
	);
	const position = (t: number) => ((t - low) / Math.max(1, high - low)) * 100;
</script>

<ul class="mt-3 divide-y divide-white/10">
	{#each days as day, i (day.date)}
		<li>
			<a
				href="{resolve('/p/[coords]/[[name]]', {
					coords: page.params.coords ?? '',
					name: encodeURIComponent(page.params.name ?? '')
				})}?day={day.date}"
				class="grid min-h-11 grid-cols-[4.5rem_1.75rem_2.75rem_2.5rem_1fr_2.5rem_1rem] items-center gap-2 rounded-xl py-2.5 text-sm transition hover:bg-white/5"
			>
				<span class="leading-tight">
					<span class="block font-semibold">{i === 0 ? m.today() : f.weekday(day.date)}</span>
					{#if confidence[i] === 'medium' || confidence[i] === 'low'}
						<span class="block text-xs text-ink-muted"
							>{confidence[i] === 'low' ? m.confidence_low() : m.confidence_medium()}</span
						>
					{/if}
				</span>
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
						class="absolute inset-y-0 rounded-full bg-linear-to-r from-cold to-warm forced-color-adjust-none forced-colors:bg-[CanvasText]"
						style="left: {position(day.min)}%; right: {100 - position(day.max)}%"
					></span>
				</span>
				<span class="font-semibold tabular-nums">
					<span class="sr-only">{m.high()} </span>{f.temp(day.max)}
				</span>
				<span class="sr-only">{conditionLabel(day.condition)}</span>
				<ChevronRight size={16} class="text-ink-muted" aria-hidden="true" />
			</a>
		</li>
	{/each}
</ul>
{#if confidence.some((c) => c === 'medium' || c === 'low')}
	<p class="mt-3 text-sm text-ink-muted">{m.confidence_note()}</p>
{/if}
