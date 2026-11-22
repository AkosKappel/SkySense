<script lang="ts">
	import { CalendarClock, ChevronRight, Droplets, History } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		compareToNormal,
		forDate,
		lastWeek,
		pastRecord,
		unusual,
		type Climate,
		type Standout
	} from '#lib/climate.js';
	import type { RecentDay } from '#lib/recent.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Coordinates, Day } from '#lib/weather.js';

	let {
		coordinates,
		today,
		f,
		children
	}: {
		coordinates: Coordinates;
		/** Today's forecast: its high, low and rain against the normal. */
		today: Day;
		f: Formatter;
		/** Short tiles stacked under the normal, beside the taller table of past years. */
		children?: Snippet;
	} = $props();

	// Loaded in the browser, not with the page: the history is extra, and the browser's request
	// reaches the CDN, which keeps a place's month of history for 30 days.
	const date = $derived(today.date);
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

	// The days before today for "the last 7 days" (H-08); the dry tile asks for the same answer.
	let recent = $state<RecentDay[] | null>(null);
	$effect(() => {
		const controller = new AbortController();
		recent = null;
		fetch(`/api/recent?lat=${coordinates.lat}&lon=${coordinates.lon}&today=${date}`, {
			signal: controller.signal
		})
			.then((r) => (r.ok ? (r.json() as Promise<RecentDay[]>) : null))
			.then((days) => (recent = days))
			.catch(() => {
				// No week line then.
			});
		return () => controller.abort();
	});

	const day = $derived(climate ? forDate(climate, date) : null);
	const comparison = $derived(day?.normal ? compareToNormal(today.max, day.normal) : null);
	const verdict = $derived(day?.normal ? unusual(today, day.normal) : null);
	const week = $derived(climate && recent ? lastWeek(recent, climate, date) : null);
	const record = $derived(day ? pastRecord(today.max, day.past) : null);

	const standout = ({ measure, percent }: Standout) => {
		const share = f.percent(percent >= 50 ? percent : 100 - percent);
		if (measure === 'rain')
			return percent === 100 ? m.unusual_rain_any() : m.unusual_rain({ percent: share });
		if (measure === 'night') {
			if (percent >= 50)
				return percent === 100
					? m.unusual_night_mild_any()
					: m.unusual_night_mild({ percent: share });
			return percent === 0 ? m.unusual_night_cold_any() : m.unusual_night_cold({ percent: share });
		}
		if (percent >= 50)
			return percent === 100 ? m.unusual_day_warm_any() : m.normal_rank_warm({ percent: share });
		return percent === 0 ? m.unusual_day_cold_any() : m.normal_rank_cold({ percent: share });
	};
	const extremes = $derived.by(() => {
		const past = day?.past ?? [];
		if (past.length < 2) return null;
		return {
			warm: past.reduce((a, b) => (b.max > a.max ? b : a)),
			cold: past.reduce((a, b) => (b.max < a.max ? b : a))
		};
	});
</script>

<div class="flex flex-col gap-4 self-start">
	{#if day?.normal && comparison}
		<section class="glass p-6">
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
			{#if verdict && verdict.level !== 'usual'}
				<p class="mt-3 font-semibold">
					{verdict.level === 'rare' ? m.unusual_rare() : m.unusual_unusual()}
				</p>
				<ul class="mt-1 text-sm text-ink-muted">
					{#each verdict.standouts as item (item.measure)}
						<li>{standout(item)}</li>
					{/each}
				</ul>
			{/if}
			{#if week !== null}
				<p class="mt-2 text-sm text-ink-muted">
					{week >= 1
						? m.unusual_week_warmer({ diff: f.tempDelta(week) })
						: week <= -1
							? m.unusual_week_colder({ diff: f.tempDelta(-week) })
							: m.unusual_week_usual()}
				</p>
			{/if}
		</section>
	{/if}
	{@render children?.()}
</div>

{#if day && extremes}
	<section class="glass p-6">
		<p class="question"><History size={18} aria-hidden="true" /> {m.past_question()}</p>
		<p class="mt-2 text-lg font-semibold">
			{m.past_answer({
				warmYear: extremes.warm.date.slice(0, 4),
				warm: f.temp(extremes.warm.max),
				coldYear: extremes.cold.date.slice(0, 4),
				cold: f.temp(extremes.cold.max)
			})}
		</p>
		{#if record}
			<p class="mt-1 text-sm text-ink-muted">
				{(record === 'warmest' ? m.past_record_warmest : m.past_record_coldest)({
					years: day.past.length
				})}
			</p>
		{/if}
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
						<tr class="border-t border-veil/10">
							<th scope="row" class="py-1.5 pr-3 text-left font-semibold">
								{past.date.slice(0, 4)}
							</th>
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
			})}?history"
			class="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
		>
			{m.history_link()}
			<ChevronRight size={16} aria-hidden="true" />
		</a>
	</section>
{/if}
