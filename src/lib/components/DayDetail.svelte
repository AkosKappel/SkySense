<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import DayFacts from '#lib/components/DayFacts.svelte';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import TempChart from '#lib/components/TempChart.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { Day, Hour } from '#lib/weather.js';

	let { day, hours, isToday, f }: { day: Day; hours: Hour[]; isToday: boolean; f: Formatter } =
		$props();
</script>

<div class="mt-5 flex items-center gap-3">
	<a
		href={resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		})}
		aria-label={m.back_to_forecast()}
		class="grid size-11 shrink-0 pill place-items-center"
	>
		<ArrowLeft size={18} aria-hidden="true" />
	</a>
	<h1 class="text-2xl font-extrabold">{isToday ? m.today() : f.date(day.date)}</h1>
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
		<WeatherIcon condition={day.condition} size={72} strokeWidth={1.25} class="shrink-0" />
	</section>

	<section class="glass p-6">
		<UmbrellaTile {hours} {f} fromNow={isToday} />
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

	<section class="glass p-6 md:col-span-2">
		<h2 class="question">{m.details()}</h2>
		<DayFacts {day} {f} />
	</section>
</div>
