<script lang="ts">
	import { RotateCcw } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { hoursAhead } from '#lib/time.js';
	import type { Current, Day, Hour } from '#lib/weather.js';

	// The hour scrubber (U-02): a native range input gives the slider role, arrows, Home, End
	// and Page keys for free. `selected` is bound so the sky behind the page follows it.
	let {
		now,
		hours,
		days,
		f,
		updated,
		place,
		utcOffsetSeconds,
		selected = $bindable(0)
	}: {
		now: Current;
		hours: Hour[];
		days: Day[];
		f: Formatter;
		updated: string | null;
		place: string;
		utcOffsetSeconds: number;
		selected?: number;
	} = $props();

	const shown = $derived(selected === 0 ? now : (hours[selected] ?? now));
	const day = $derived(days.find((d) => shown.time.startsWith(d.date)) ?? days[0]);
	const when = $derived(`${f.weekday(shown.time.slice(0, 10))} ${f.time(shown.time)}`);
	const spoken = (hour: Hour) =>
		`${f.weekday(hour.time.slice(0, 10))} ${f.time(hour.time)}, ${f.temp(hour.temp)}, ${conditionLabel(hour.condition, hour.isDay)}`;

	// Times are the place's own; say so when they differ from the reader's clock (F-13). Only the
	// browser knows the reader's time zone, so this appears after the page loads.
	let readerOffset = $state<number | null>(null);
	onMount(() => (readerOffset = -new Date().getTimezoneOffset()));
	const ahead = $derived(readerOffset === null ? 0 : hoursAhead(utcOffsetSeconds, readerOffset));
	const zoneNote = $derived.by(() => {
		if (!ahead) return null;
		const hours = Math.abs(ahead);
		const shown = new Intl.NumberFormat(getLocale()).format(hours);
		return ahead > 0 ? m.tz_ahead({ place, hours, shown }) : m.tz_behind({ place, hours, shown });
	});
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<p class="text-sm font-medium text-ink-muted">
			{selected === 0 ? m.now_at({ time: when }) : m.at_time({ time: when })}
		</p>
		<p class="mt-2 text-8xl font-bold tracking-tight tabular-nums">{f.temp(shown.temp)}</p>
		<p class="mt-1 text-lg">
			{conditionLabel(shown.condition, shown.isDay)} · {m.feels_like({ temp: f.temp(shown.feels) })}
		</p>
	</div>
	<WeatherIcon
		condition={shown.condition}
		isDay={shown.isDay}
		size={88}
		strokeWidth={1.25}
		class="shrink-0 drop-shadow-[0_0_24px_rgba(251,191,36,.35)]"
	/>
</div>
<p class="mt-6 text-lg text-ink-muted">
	{m.high_low({ max: f.temp(day.max), min: f.temp(day.min) })}
</p>

<div class="mt-4">
	<div class="flex min-h-11 items-center justify-between gap-2">
		<label for="scrubber" class="question">{m.look_ahead()}</label>
		{#if selected > 0}
			<button
				type="button"
				class="flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-sm font-semibold"
				onclick={() => (selected = 0)}
			>
				<RotateCcw size={14} aria-hidden="true" />
				{m.back_to_now()}
			</button>
		{/if}
	</div>
	<input
		id="scrubber"
		type="range"
		min="0"
		max={hours.length - 1}
		step="1"
		bind:value={selected}
		aria-valuetext={spoken(hours[selected] ?? hours[0])}
		class="h-11 w-full cursor-pointer rounded-full accent-sun"
	/>
	<div class="flex justify-between text-xs text-ink-muted" aria-hidden="true">
		<span>{m.now()}</span>
		<span>{m.in_hours({ hours: Math.floor((hours.length - 1) / 2) })}</span>
		<span>{m.in_hours({ hours: hours.length - 1 })}</span>
	</div>
</div>

<p class="mt-2 text-sm text-ink-muted">
	{updated ? m.updated_ago({ ago: updated }) : m.updated_just_now()}
</p>
{#if zoneNote}<p class="mt-1 text-sm text-ink-muted">{zoneNote}</p>{/if}
