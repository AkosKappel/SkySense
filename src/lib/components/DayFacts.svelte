<script lang="ts">
	import { Droplets, Gauge } from '@lucide/svelte';
	import { uvLevel, type Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { pressureTrend, type Pressure } from '#lib/pressure.js';
	import { RAIN_LIKELY, type Day } from '#lib/weather.js';

	// Humidity and pressure are readings for now, so only today's tile passes them.
	let {
		day,
		f,
		humidity,
		pressure = null
	}: { day: Day; f: Formatter; humidity?: number; pressure?: Pressure | null } = $props();

	const trends = {
		risingFast: m.pressure_rising_fast,
		rising: m.pressure_rising,
		steady: m.pressure_steady,
		falling: m.pressure_falling,
		fallingFast: m.pressure_falling_fast
	};
	const pressureText = $derived(
		pressure
			? [
					f.pressure(pressure.hpa),
					...(pressure.change === null ? [] : [trends[pressureTrend(pressure.change)]()])
				].join(' · ')
			: null
	);

	const uvLabel = $derived(
		{
			low: m.uv_low,
			moderate: m.uv_moderate,
			high: m.uv_high,
			veryHigh: m.uv_very_high,
			extreme: m.uv_extreme
		}[uvLevel(day.uvMax)]()
	);

	const facts = $derived(
		[
			[m.uv_index(), `${Math.round(day.uvMax)} · ${uvLabel}`],
			humidity === undefined ? null : [m.humidity(), f.percent(humidity)],
			[m.rain_amount(), f.rain(day.rain)],
			[m.rain_chance_label(), f.percent(day.rainChance)],
			[m.sunrise(), day.sunrise ? f.time(day.sunrise) : '–'],
			[m.sunset(), day.sunset ? f.time(day.sunset) : '–']
		].filter((fact) => fact !== null)
	);
</script>

<dl class="mt-4 grid grid-cols-2 gap-3">
	{#each facts as [label, value] (label)}
		<div class="rounded-2xl bg-white/5 p-4 outline-1 outline-white/10">
			<dt class="text-sm wrap-anywhere hyphens-auto text-ink-muted">{label}</dt>
			<dd class="mt-1 text-xl font-bold tabular-nums">{value}</dd>
		</div>
	{/each}
	{#if pressureText}
		<div class="col-span-2 rounded-2xl bg-white/5 p-4 outline-1 outline-white/10">
			<dt class="text-sm text-ink-muted">{m.pressure()}</dt>
			<dd class="mt-1 text-xl font-bold tabular-nums">{pressureText}</dd>
		</div>
	{/if}
</dl>
<p class="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
	<Droplets size={14} aria-hidden="true" />
	{m.rain_likely_note({ percent: f.percent(RAIN_LIKELY) })}
</p>
{#if pressureText}
	<p class="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
		<Gauge size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
		{m.pressure_note()}
	</p>
{/if}
