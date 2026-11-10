<script lang="ts">
	import { Bike, Camera, Check, Dog, Footprints, Shirt, Sparkles, Telescope } from '@lucide/svelte';
	import {
		activities,
		activityIds,
		bestWindow,
		type ActivityId,
		type Reason
	} from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day, Hour } from '#lib/weather.js';

	let { hours, days, f }: { hours: Hour[]; days: Day[]; f: Formatter } = $props();

	const icons = {
		run: Footprints,
		cycle: Bike,
		walk: Dog,
		laundry: Shirt,
		stars: Telescope,
		golden: Camera
	};
	const names: Record<ActivityId, () => string> = {
		run: m.activity_run,
		cycle: m.activity_cycle,
		walk: m.activity_walk,
		laundry: m.activity_laundry,
		stars: m.activity_stars,
		golden: m.activity_golden
	};
	const reasons: Record<Reason, () => string> = {
		cold: m.reason_cold,
		hot: m.reason_hot,
		rain: m.reason_rain,
		wind: m.reason_wind,
		dark: m.reason_dark,
		daylight: m.reason_daylight,
		clouds: m.reason_clouds,
		notGolden: m.reason_notGolden,
		uv: m.reason_uv
	};

	const today = $derived(hours[0]?.time.slice(0, 10));
	const rows = $derived(
		activityChoice.list.map((id) => ({ id, ...bestWindow(activities[id], hours, days) }))
	);

	function range(from: string, until: string) {
		const times = { from: f.time(from), until: f.time(until) };
		return from.startsWith(today)
			? m.window_range(times)
			: m.window_range_on({ day: f.weekday(from.slice(0, 10)), ...times });
	}
</script>

<p class="question"><Sparkles size={18} aria-hidden="true" /> {m.go_out_question()}</p>

{#if rows.length}
	<ul class="mt-3 space-y-2">
		{#each rows as row (row.id)}
			{@const Icon = icons[row.id]}
			<li
				class="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 outline-1 outline-white/10"
			>
				<Icon size={20} class="shrink-0 text-ink-muted" aria-hidden="true" />
				<div class="min-w-0 flex-1">
					<p class="font-semibold">{names[row.id]()}</p>
					{#if row.window}
						<p class="text-lg font-bold tabular-nums">{range(row.window.from, row.window.until)}</p>
					{:else if row.reason}
						<p class="text-sm text-ink-muted">{reasons[row.reason]()}</p>
					{/if}
				</div>
				{#if row.window}
					<span
						class="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold {row.window.score >= 80
							? 'bg-good/20 text-good'
							: 'bg-white/10'}">{row.window.score >= 80 ? m.window_great() : m.window_good()}</span
					>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-3 text-ink-muted">{m.no_activities()}</p>
{/if}

<details class="mt-3">
	<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold">
		{m.choose_activities()}
	</summary>
	<div class="flex flex-wrap gap-2 pt-1">
		{#each activityIds as id (id)}
			<label
				class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold outline-1 outline-white/20 has-checked:bg-white/25 has-checked:outline-white/60 has-focus-visible:outline-2 has-focus-visible:outline-white"
			>
				<input
					type="checkbox"
					class="sr-only"
					checked={activityChoice.list.includes(id)}
					onchange={() => activityChoice.toggle(id)}
				/>
				{#if activityChoice.list.includes(id)}<Check size={16} aria-hidden="true" />{/if}
				{names[id]()}
			</label>
		{/each}
	</div>
</details>
