<script lang="ts">
	import {
		Bike,
		Camera,
		Check,
		ChevronDown,
		Dog,
		Footprints,
		Shirt,
		Sparkles,
		Telescope
	} from '@lucide/svelte';
	import {
		activities,
		activityIds,
		bestWindow,
		comfortShift,
		type ActivityId,
		type Comfort,
		type FactorId,
		type Reason
	} from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day, Hour } from '#lib/weather.js';

	let {
		hours,
		days,
		f,
		comfort = 'neutral'
	}: { hours: Hour[]; days: Day[]; f: Formatter; comfort?: Comfort } = $props();

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
		uv: m.reason_uv,
		moon: m.reason_moon
	};

	const factorNames: Record<FactorId, () => string> = {
		feels: m.factor_feels,
		temp: m.factor_temp,
		rain: m.factor_rain,
		wind: m.factor_wind,
		light: m.factor_light,
		uv: m.factor_uv,
		clouds: m.factor_clouds,
		moon: m.factor_moon
	};
	const level = (value: number) =>
		value >= 0.9 ? m.level_ideal() : value >= 0.5 ? m.level_ok() : m.level_poor();

	const today = $derived(hours[0]?.time.slice(0, 10));
	const rows = $derived(
		activityChoice.list.map((id) => ({
			id,
			...bestWindow(activities[id], hours, days, comfortShift[comfort])
		}))
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
			<li class="rounded-2xl bg-white/5 outline-1 outline-white/10">
				<details class="group">
					<summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
						<Icon size={20} class="shrink-0 text-ink-muted" aria-hidden="true" />
						<div class="min-w-0 flex-1">
							<p class="font-semibold">{names[row.id]()}</p>
							{#if row.window}
								<p class="text-lg font-bold tabular-nums">
									{range(row.window.from, row.window.until)}
								</p>
							{:else if row.reason}
								<p class="text-sm text-ink-muted">{reasons[row.reason]()}</p>
							{/if}
						</div>
						{#if row.window}
							<span
								class="shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold {row.window.score >=
								80
									? 'bg-good/20 text-good'
									: 'bg-white/10'}"
								>{row.window.score >= 80 ? m.window_great() : m.window_good()}</span
							>
						{/if}
						{#if row.detail}
							<ChevronDown
								size={18}
								class="shrink-0 text-ink-muted transition group-open:rotate-180 motion-reduce:transition-none"
								aria-hidden="true"
							/>
						{/if}
					</summary>
					{#if row.detail}
						<div class="px-4 pb-4">
							<p class="text-sm font-semibold">
								{row.window
									? m.score_of({ score: row.detail.score })
									: m.best_hour_score({ time: f.time(row.detail.time), score: row.detail.score })}
							</p>
							<dl class="mt-2 space-y-2">
								{#each row.detail.factors as factor (factor.id)}
									<div class="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
										<dt class="text-ink-muted">{factorNames[factor.id]()}</dt>
										<div class="h-1.5 rounded-full bg-white/10" aria-hidden="true">
											<div
												class="h-full rounded-full bg-white/70 forced-color-adjust-none forced-colors:bg-[CanvasText]"
												style:width="{Math.round(factor.value * 100)}%"
											></div>
										</div>
										<dd class="font-semibold">{level(factor.value)}</dd>
									</div>
								{/each}
							</dl>
						</div>
					{/if}
				</details>
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
