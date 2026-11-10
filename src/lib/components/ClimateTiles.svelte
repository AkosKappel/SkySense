<script lang="ts">
	import { CalendarClock, ChevronRight, Droplets, History } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { compareToNormal, forDate, type Climate } from '#lib/climate.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Coordinates } from '#lib/weather.js';

	let {
		coordinates,
		date,
		max,
		place,
		f
	}: { coordinates: Coordinates; date: string; max: number; place: string; f: Formatter } =
		$props();

	// Loaded in the browser, not with the page: the history is extra, and the browser's request
	// reaches the CDN, which keeps a place's month of history for 30 days.
	let climate = $state<Climate | null>(null);
	$effect(() => {
		const controller = new AbortController();
		const query = `lat=${coordinates.lat}&lon=${coordinates.lon}&month=${date.slice(0, 7)}`;
		climate = null;
		fetch(`/api/climate?${query}`, { signal: controller.signal })
			.then((r) => (r.ok ? (r.json() as Promise<Climate>) : null))
			.then((c) => (climate = c))
			.catch(() => {
				// No history then; the tiles stay hidden.
			});
		return () => controller.abort();
	});

	const day = $derived(climate ? forDate(climate, date) : null);
	const comparison = $derived(day?.normal ? compareToNormal(max, day.normal) : null);
	const extremes = $derived.by(() => {
		const past = day?.past ?? [];
		if (past.length < 2) return null;
		return {
			warm: past.reduce((a, b) => (b.max > a.max ? b : a)),
			cold: past.reduce((a, b) => (b.max < a.max ? b : a))
		};
	});
</script>

{#if day?.normal && comparison}
	<section class="self-start glass p-6 lg:col-span-2">
		<p class="question"><CalendarClock size={18} aria-hidden="true" /> {m.normal_question()}</p>
		<p class="mt-2 answer">
			{comparison.kind === 'warmer'
				? m.normal_warmer({ diff: f.tempDelta(comparison.diff) })
				: comparison.kind === 'colder'
					? m.normal_colder({ diff: f.tempDelta(comparison.diff) })
					: m.normal_about()}
		</p>
		<p class="mt-2 text-ink-muted">
			{m.normal_typical({ max: f.temp(day.normal.max[5]), min: f.temp(day.normal.min[5]) })}
		</p>
		{#if comparison.percent >= 90}
			<p class="mt-1 text-sm text-ink-muted">
				{m.normal_rank_warm({ percent: f.percent(comparison.percent) })}
			</p>
		{:else if comparison.percent <= 10}
			<p class="mt-1 text-sm text-ink-muted">
				{m.normal_rank_cold({ percent: f.percent(100 - comparison.percent) })}
			</p>
		{/if}
	</section>
{/if}

{#if day && extremes}
	<section class="glass p-6 lg:col-span-2">
		<p class="question"><History size={18} aria-hidden="true" /> {m.past_question()}</p>
		<p class="mt-2 text-lg font-semibold">
			{m.past_answer({
				warmYear: extremes.warm.date.slice(0, 4),
				warm: f.temp(extremes.warm.max),
				coldYear: extremes.cold.date.slice(0, 4),
				cold: f.temp(extremes.cold.max)
			})}
		</p>
		<div class="relative mt-4 overflow-x-auto">
			<table class="w-full text-sm tabular-nums">
				<caption class="sr-only">{m.past_question()}</caption>
				<thead class="text-left text-ink-muted">
					<tr>
						<th scope="col" class="py-1 pr-3 font-medium">{m.year()}</th>
						<th scope="col" class="py-1 pr-3 font-medium">{m.high()}</th>
						<th scope="col" class="py-1 pr-3 font-medium">{m.low()}</th>
						<th scope="col" class="py-1 font-medium">{m.rain_amount()}</th>
					</tr>
				</thead>
				<tbody>
					{#each day.past as past (past.date)}
						<tr class="border-t border-white/10">
							<th scope="row" class="py-1.5 pr-3 text-left font-semibold"
								>{past.date.slice(0, 4)}</th
							>
							<td class="pr-3">{f.temp(past.max)}</td>
							<td class="pr-3 text-ink-muted">{f.temp(past.min)}</td>
							<td class={past.rain >= 0.1 ? 'text-rain-soft' : 'text-ink-muted'}>
								<span class="inline-flex items-center gap-1">
									{#if past.rain >= 0.1}<Droplets size={14} aria-hidden="true" />{/if}
									{f.rain(past.rain)}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<a
			href="{resolve('/p/[coords]/[[name]]', {
				coords: page.params.coords ?? '',
				name: encodeURIComponent(page.params.name ?? '')
			})}?year"
			class="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
			>{m.year_title({ place })} <ChevronRight size={16} aria-hidden="true" /></a
		>
	</section>
{/if}
