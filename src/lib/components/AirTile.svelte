<script lang="ts">
	import { Flower2, Leaf } from '@lucide/svelte';
	import type { AirSummary } from '#lib/air.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';

	let { summary, f }: { summary: AirSummary; f: Formatter } = $props();

	const plants = {
		alder: m.pollen_alder,
		birch: m.pollen_birch,
		grass: m.pollen_grass,
		mugwort: m.pollen_mugwort,
		olive: m.pollen_olive,
		ragweed: m.pollen_ragweed
	};
	const answer = $derived.by(() => {
		const air = summary.air;
		if (!air) return m.air_clean();
		const say = {
			moderate: m.air_moderate,
			poor: m.air_poor,
			veryPoor: m.air_very_poor,
			extreme: m.air_extreme
		}[air.level as 'moderate' | 'poor' | 'veryPoor' | 'extreme'];
		return say({ time: f.time(air.time) });
	});
</script>

<p class="question"><Leaf size={18} aria-hidden="true" /> {m.air_question()}</p>
<p class="mt-2 text-xl font-bold">{answer}</p>
{#if summary.air}
	<p class="mt-1 text-sm text-ink-muted">
		{m.air_index({ aqi: summary.air.aqi })}
		{#if summary.air.level !== 'moderate'}{m.air_advice()}{/if}
	</p>
{/if}
{#if summary.pollen}
	<p class="mt-2 flex items-center gap-1.5 font-semibold">
		<Flower2 size={16} aria-hidden="true" />
		{(summary.pollen.level === 'high' ? m.pollen_high : m.pollen_moderate)({
			kind: plants[summary.pollen.kind]()
		})}
	</p>
{/if}
