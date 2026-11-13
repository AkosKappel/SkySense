<script lang="ts">
	import { Droplets, Trophy } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { comfortShift, type Comfort } from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { activityIcons } from '#lib/components/activity-icons.js';
	import { activityLabel, conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { barHeight, bestDays, weekRows } from '#lib/week.js';
	import type { Day, Hour } from '#lib/weather.js';

	// The week page (F-24): which day is best for each chosen activity, then every day as a row of
	// its hours, with the day's best times. A day opens its own view, which has the hours in words.
	let { days, hours, f, comfort }: { days: Day[]; hours: Hour[]; f: Formatter; comfort: Comfort } =
		$props();

	const shift = $derived(comfortShift[comfort]);
	const best = $derived(bestDays(days, hours, activityChoice.list, shift));
	const rows = $derived(weekRows(days, hours, activityChoice.list, shift));
	const low = $derived(Math.min(...hours.map((h) => h.temp)));
	const high = $derived(Math.max(...hours.map((h) => h.temp)));
	const dayLabel = (date: string) => (date === days[0].date ? m.today() : f.date(date));
</script>

{#if best.length}
	<section class="mt-4 glass p-6">
		<h2 class="question"><Trophy size={18} aria-hidden="true" /> {m.week_best_question()}</h2>
		<ul class="mt-3 space-y-2">
			{#each best as { id, window } (id)}
				{@const Icon = activityIcons[id]}
				<li class="flex items-start gap-3">
					<Icon size={20} class="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
					<span class="text-lg font-semibold">
						{window
							? m.week_best_day({
									activity: activityLabel(id),
									day: dayLabel(window.from.slice(0, 10)),
									from: f.time(window.from),
									until: f.time(window.until)
								})
							: m.week_best_none({ activity: activityLabel(id) })}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="mt-4 glass p-4 md:p-6">
	<h2 class="question px-2">{m.ten_days()}</h2>
	<p class="mt-1 px-2 text-sm text-ink-muted">{m.week_legend()}</p>
	<!-- The hour axis, over the strips' column. -->
	<div
		class="mt-3 hidden px-2 text-xs text-ink-muted md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6 xl:grid-cols-[13rem_minmax(0,1fr)_19rem]"
		aria-hidden="true"
	>
		<span class="col-start-2 flex">
			{#each [0, 6, 12, 18] as hour (hour)}
				<span class="flex-1">{f.hour(`2026-01-01T${String(hour).padStart(2, '0')}:00`)}</span>
			{/each}
		</span>
	</div>
	<ul class="mt-1 divide-y divide-veil/10">
		{#each rows as row (row.day.date)}
			<li
				class="grid gap-x-6 gap-y-2 px-2 py-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-center xl:grid-cols-[13rem_minmax(0,1fr)_19rem]"
			>
				<div>
					<a
						href="{resolve('/p/[coords]/[[name]]', {
							coords: page.params.coords ?? '',
							name: encodeURIComponent(page.params.name ?? '')
						})}?day={row.day.date}"
						class="font-semibold whitespace-nowrap underline-offset-4 hover:underline"
						>{dayLabel(row.day.date)}</a
					>
					<p class="mt-1 flex items-center gap-2 text-sm tabular-nums">
						<WeatherIcon condition={row.day.condition} size={20} />
						<span class="sr-only">{conditionLabel(row.day.condition)}</span>
						<span class="font-semibold">
							<span class="sr-only">{`${m.high()} `}</span>{f.temp(row.day.max)}
						</span>
						<span class="text-ink-muted">
							<span class="sr-only">{`${m.low()} `}</span>{f.temp(row.day.min)}
						</span>
						{#if row.day.rainChance >= 20}
							<span class="flex items-center gap-0.5 text-rain-soft">
								<Droplets size={12} aria-hidden="true" />
								<span class="sr-only">{m.rain_chance_label()}</span>
								{f.percent(row.day.rainChance)}
							</span>
						{/if}
					</p>
				</div>

				<!-- The hours from midnight: bar height is the temperature, the strip below the rain. -->
				<div class="flex h-14 gap-px" aria-hidden="true">
					{#each row.hours as hour, i (i)}
						<div class="flex flex-1 flex-col justify-end gap-0.5">
							{#if hour}
								<div
									class="rounded-t-sm forced-color-adjust-none {hour.isDay
										? 'bg-sun-soft/80'
										: 'bg-veil/30'}"
									style:height="{barHeight(hour.temp, low, high) * 80}%"
								></div>
								<div
									class="h-1.5 rounded-sm bg-rain forced-color-adjust-none"
									style:opacity={hour.rainChance / 100}
								></div>
							{/if}
						</div>
					{/each}
				</div>

				{#if row.windows.length}
					<ul class="flex flex-wrap gap-2 text-sm md:col-start-2 xl:col-start-auto">
						{#each row.windows as { id, window } (id)}
							{@const Icon = activityIcons[id]}
							<li
								class="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold tabular-nums {window.great
									? 'bg-good/20 text-good'
									: 'bg-veil/10'}"
							>
								<Icon size={14} aria-hidden="true" />
								<span class="sr-only">{`${activityLabel(id)}: `}</span>
								{m.window_range({ from: f.time(window.from), until: f.time(window.until) })}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</section>
