<script lang="ts">
	import { CloudFog, Droplets, Gauge } from '@lucide/svelte';
	import Meter from '#lib/components/Meter.svelte';
	import { dewComfort, fogAhead } from '#lib/details.js';
	import { uvLevel, type Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { pressureTrend, type Pressure } from '#lib/pressure.js';
	import { RAIN_LIKELY, type Day, type Hour } from '#lib/weather.js';

	// Humidity, pressure and the hours ahead are readings for now, so only today's tile passes them.
	let {
		day,
		f,
		humidity,
		pressure = null,
		ahead = []
	}: {
		day: Day;
		f: Formatter;
		humidity?: number;
		pressure?: Pressure | null;
		ahead?: Hour[];
	} = $props();

	const hour = $derived(ahead[0]);
	const dewText = $derived.by(() => {
		if (hour?.dewPoint === undefined) return null;
		const feel = dewComfort(hour.dewPoint);
		const word = feel && { muggy: m.dew_muggy, oppressive: m.dew_oppressive }[feel]();
		return word ? `${f.temp(hour.dewPoint)} · ${word}` : f.temp(hour.dewPoint);
	});
	const fog = $derived(fogAhead(ahead));

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

	type Fact = {
		label: string;
		value: string;
		meter?: { value: number; min: number; max: number; bands?: [number, string][] };
	};
	// UV bands follow the WHO scale: low, moderate, high, very high and extreme.
	const uvBands: [number, string][] = [
		[3, 'bg-good'],
		[6, 'bg-sun'],
		[8, 'bg-warm'],
		[12, 'bg-rose']
	];

	const facts = $derived(
		(
			[
				{
					label: m.uv_index(),
					value: `${Math.round(day.uvMax)} · ${uvLabel}`,
					meter: { value: day.uvMax, min: 0, max: 12, bands: uvBands }
				},
				humidity === undefined
					? null
					: {
							label: m.humidity(),
							value: f.percent(humidity),
							meter: { value: humidity, min: 0, max: 100 }
						},
				dewText === null ? null : { label: m.dew_point(), value: dewText },
				hour?.visibility === undefined
					? null
					: { label: m.visibility(), value: f.distance(hour.visibility) },
				{ label: m.rain_amount(), value: f.rain(day.rain) },
				{
					label: m.rain_chance_label(),
					value: f.percent(day.rainChance),
					meter: { value: day.rainChance, min: 0, max: 100 }
				},
				{ label: m.sunrise(), value: day.sunrise ? f.time(day.sunrise) : '–' },
				{ label: m.sunset(), value: day.sunset ? f.time(day.sunset) : '–' }
			] satisfies (Fact | null)[]
		).filter((fact) => fact !== null)
	);
</script>

<!-- An odd last fact spans both columns rather than leaving a gap beside it. -->
<dl class="mt-4 grid grid-cols-2 gap-3 [&>:last-child:nth-child(odd)]:col-span-2">
	{#each facts as { label, value, meter } (label)}
		<div class="rounded-2xl bg-veil/5 p-4 outline-1 outline-veil/10">
			<dt class="text-sm wrap-anywhere hyphens-auto text-ink-muted">{label}</dt>
			<dd class="mt-1 text-xl font-bold tabular-nums">
				<span>{value}</span>
				{#if meter}<Meter {...meter} />{/if}
			</dd>
		</div>
	{/each}
	{#if pressureText && pressure}
		<div class="col-span-2 rounded-2xl bg-veil/5 p-4 outline-1 outline-veil/10">
			<dt class="text-sm text-ink-muted">{m.pressure()}</dt>
			<dd class="mt-1 text-xl font-bold tabular-nums">
				<span>{pressureText}</span>
				<!-- From a deep low to a strong high; most days sit between 1000 and 1030 hPa. -->
				<Meter
					value={pressure.hpa}
					min={970}
					max={1050}
					bands={[
						[1000, 'bg-rain'],
						[1025, 'bg-veil/30'],
						[1050, 'bg-sun']
					]}
				/>
			</dd>
		</div>
	{/if}
</dl>
<p class="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
	<Droplets size={14} aria-hidden="true" />
	{m.rain_likely_note({ percent: f.percent(RAIN_LIKELY) })}
</p>
{#if fog}
	<p class="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
		<CloudFog size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
		{fog.from === hour?.time
			? m.fog_now({ until: f.time(fog.until) })
			: m.fog_ahead({ from: f.time(fog.from), until: f.time(fog.until) })}
	</p>
{/if}
{#if pressureText}
	<p class="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
		<Gauge size={14} class="mt-0.5 shrink-0" aria-hidden="true" />
		{m.pressure_note()}
	</p>
{/if}
