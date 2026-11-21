<script lang="ts">
	import { Target } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { checkForecast, HIGH_TOLERANCE, type HindcastDay } from '#lib/hindcast.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Coordinates } from '#lib/weather.js';

	// How good was the forecast? (X-14). Loaded in the browser like the dry spell: it is extra.
	let { coordinates, today, f }: { coordinates: Coordinates; today: string; f: Formatter } =
		$props();

	let days = $state<HindcastDay[] | null>(null);
	$effect(() => {
		const controller = new AbortController();
		const query = `lat=${coordinates.lat}&lon=${coordinates.lon}&today=${today}`;
		days = null;
		fetch(`/api/hindcast?${query}`, { signal: controller.signal })
			.then((r) => (r.ok ? (r.json() as Promise<HindcastDay[]>) : null))
			.then((d) => (days = d))
			.catch(() => {
				// No tile then.
			});
		return () => controller.abort();
	});

	const check = $derived(days ? checkForecast(days, today) : null);
</script>

{#if check}
	<section class="glass p-6">
		<p class="question"><Target size={18} aria-hidden="true" /> {m.hindcast_question()}</p>
		<p class="mt-2 answer">
			{Math.abs(check.highError) < 1
				? m.hindcast_right()
				: check.highError > 0
					? m.hindcast_warm({ diff: f.tempDelta(check.highError) })
					: m.hindcast_cold({ diff: f.tempDelta(-check.highError) })}
			{#if check.rain === 'missed'}
				{m.hindcast_missed_rain()}
			{:else if check.rain === 'unexpected'}
				{m.hindcast_unexpected_rain()}
			{/if}
		</p>
		{#if check.rate}
			<p class="mt-2 text-sm text-ink-muted">
				{m.hindcast_rate({ hits: check.rate.hits, days: check.rate.days })}
			</p>
		{/if}
		<p class="mt-1 text-xs text-ink-muted">
			{m.hindcast_note({ tolerance: f.tempDelta(HIGH_TOLERANCE) })}
		</p>
	</section>
{/if}
