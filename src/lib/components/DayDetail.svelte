<script lang="ts">
	import { ArrowLeft, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ActivityTile from '#lib/components/ActivityTile.svelte';
	import DayFacts from '#lib/components/DayFacts.svelte';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import TempChart from '#lib/components/TempChart.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Comfort } from '#lib/activities.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day, Hour } from '#lib/weather.js';

	let {
		day,
		hours,
		days,
		isToday,
		f,
		comfort = 'neutral'
	}: {
		day: Day;
		hours: Hour[];
		days: Day[];
		isToday: boolean;
		f: Formatter;
		comfort?: Comfort;
	} = $props();

	const forecastHref = $derived(
		resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})
	);
	const index = $derived(days.findIndex((d) => d.date === day.date));
	const previous = $derived(days[index - 1]);
	const next = $derived(days[index + 1]);
</script>

<div class="mt-5 flex items-center gap-3">
	<a
		href={forecastHref}
		aria-label={m.back_to_forecast()}
		title={m.back_to_forecast()}
		class="grid size-11 shrink-0 pill place-items-center"
	>
		<ArrowLeft size={18} aria-hidden="true" />
	</a>
	<h1 class="min-w-0 flex-1 text-2xl font-extrabold">{isToday ? m.today() : f.date(day.date)}</h1>
	<!-- Step through the days without going back to the list; the ends of the forecast show a
	     disabled button so the pair does not jump around. -->
	<nav aria-label={m.days_nav()} class="flex shrink-0 gap-2 print:hidden">
		{#each [{ to: previous, Icon: ChevronLeft, label: m.previous_day }, { to: next, Icon: ChevronRight, label: m.next_day }] as { to, Icon, label } (label)}
			{#if to}
				<a
					href="{forecastHref}?day={to.date}"
					aria-label={label({ day: f.date(to.date) })}
					title={label({ day: f.date(to.date) })}
					data-sveltekit-noscroll
					class="grid size-11 pill place-items-center"
				>
					<Icon size={18} aria-hidden="true" />
				</a>
			{:else}
				<span class="grid size-11 pill place-items-center opacity-40" aria-hidden="true">
					<Icon size={18} />
				</span>
			{/if}
		{/each}
	</nav>
</div>

<div class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 [&>*]:min-w-0">
	<section class="flex items-center justify-between gap-4 glass p-6">
		<div>
			<p class="text-6xl font-bold tracking-tight tabular-nums">{f.temp(day.max)}</p>
			<p class="mt-1 text-lg">{conditionLabel(day.condition)}</p>
			<p class="mt-2 text-ink-muted">
				{m.high_low({ max: f.temp(day.max), min: f.temp(day.min) })}
			</p>
		</div>
		<WeatherIcon condition={day.condition} size={72} strokeWidth={1.25} halo />
	</section>

	<section class="glass p-6">
		<UmbrellaTile {hours} {f} fromNow={isToday} />
	</section>

	<!-- When to go out that day: the same tile as the overview, for this day's hours. -->
	<section class="glass p-6">
		<ActivityTile {hours} {days} {f} {comfort} scope="day" />
	</section>

	<section class="glass p-6">
		<h2 class="question">{m.details()}</h2>
		<DayFacts {day} {f} />
	</section>

	<section class="glass p-5 md:col-span-2">
		<h2 class="question">{m.hour_by_hour()}</h2>
		<HourlyStrip {hours} {f} fromNow={isToday} />
	</section>

	{#if hours.length > 1}
		<section class="glass p-6 md:col-span-2">
			<TempChart {hours} {f} />
		</section>
	{/if}
</div>
