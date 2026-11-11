<script lang="ts">
	import { Sprout } from '@lucide/svelte';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { drySpell, type RainDay } from '#lib/recent.js';
	import type { Coordinates } from '#lib/weather.js';

	// How dry it has been (H-04). Loaded in the browser like the climate tiles: it is extra, and the
	// browser's request reaches the CDN.
	let { coordinates, today, f }: { coordinates: Coordinates; today: string; f: Formatter } =
		$props();

	let days = $state<RainDay[] | null>(null);
	$effect(() => {
		const controller = new AbortController();
		const query = `lat=${coordinates.lat}&lon=${coordinates.lon}&today=${today}`;
		days = null;
		fetch(`/api/recent?${query}`, { signal: controller.signal })
			.then((r) => (r.ok ? (r.json() as Promise<RainDay[]>) : null))
			.then((d) => (days = d))
			.catch(() => {
				// No tile then.
			});
		return () => controller.abort();
	});

	const spell = $derived(days ? drySpell(days, today) : null);
</script>

{#if spell}
	<section class="glass p-6">
		<p class="question"><Sprout size={18} aria-hidden="true" /> {m.dry_question()}</p>
		<p class="mt-2 answer">
			{!spell.last
				? m.dry_none({ days: spell.covered })
				: spell.dryDays === 0
					? m.dry_yesterday()
					: m.dry_days({ days: spell.dryDays })}
		</p>
		{#if spell.last}
			<p class="mt-2 text-sm text-ink-muted">
				{m.dry_last({ rain: f.rain(spell.last.rain), date: f.date(spell.last.date) })}
			</p>
		{/if}
		{#if spell.month}
			<p class="mt-1 text-sm text-ink-muted">{m.dry_month({ rain: f.rain(spell.month.rain) })}</p>
		{/if}
		<p class="mt-1 text-xs text-ink-muted">{m.dry_note()}</p>
	</section>
{/if}
