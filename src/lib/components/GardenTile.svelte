<script lang="ts">
	import { Flower2 } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { gardenAdvice, type GardenDay } from '#lib/garden.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Coordinates } from '#lib/weather.js';

	// Does the garden need anything? (X-16). Loaded in the browser like the dry spell, and shown
	// only when there is something to do.
	let { coordinates, today, f }: { coordinates: Coordinates; today: string; f: Formatter } =
		$props();

	let days = $state<GardenDay[] | null>(null);
	$effect(() => {
		const controller = new AbortController();
		const query = `lat=${coordinates.lat}&lon=${coordinates.lon}&today=${today}`;
		days = null;
		fetch(`/api/garden?${query}`, { signal: controller.signal })
			.then((r) => (r.ok ? (r.json() as Promise<GardenDay[]>) : null))
			.then((d) => (days = d))
			.catch(() => {
				// No tile then.
			});
		return () => controller.abort();
	});

	const advice = $derived(days ? gardenAdvice(days, today) : null);
</script>

{#if advice}
	<section class="glass p-6">
		<p class="question"><Flower2 size={18} aria-hidden="true" /> {m.garden_question()}</p>
		<p class="mt-2 answer">
			{#if advice.short !== null}
				{(advice.rainSoon ? m.garden_rain_coming : m.garden_water)({
					short: f.rain(advice.short)
				})}
			{/if}
			{#if advice.frost.length}
				{m.garden_frost({ count: advice.frost.length, day: f.date(advice.frost[0]) })}
			{/if}
		</p>
		<p class="mt-2 text-xs text-ink-muted">{m.garden_note()}</p>
	</section>
{/if}
