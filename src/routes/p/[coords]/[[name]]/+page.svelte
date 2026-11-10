<script lang="ts">
	import {
		ChevronDown,
		Droplets,
		MapPin,
		Navigation,
		Plus,
		Settings,
		Sunset,
		Wind
	} from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DailyList from '#lib/components/DailyList.svelte';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { darkness } from '#lib/daylight.js';
	import { formatter, uvLevel, windLevel } from '#lib/format.js';
	import { age, STALE_AFTER_MS } from '#lib/freshness.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { rememberLastPlace, savedPlaces } from '#lib/places.svelte.js';
	import { beaufort } from '#lib/units.js';
	import { RAIN_LIKELY } from '#lib/weather.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const f = $derived(formatter(getLocale(), data.units));
	const forecast = $derived(data.forecast);
	const now = $derived(forecast.current);
	const today = $derived(forecast.days[0]);
	const name = $derived(data.name ?? m.unnamed_place());
	const place = $derived({ name, ...data.coordinates });
	const dark = $derived(darkness(now.time, today, forecast.days[1], forecast.hours));
	const wind = $derived(windLevel(beaufort(now.wind)));
	const uv = $derived(uvLevel(today.uvMax));

	const windAnswer = $derived(
		{
			calm: m.wind_calm,
			light: m.wind_light,
			breezy: m.wind_breezy,
			windy: m.wind_windy,
			stormy: m.wind_stormy
		}[wind]()
	);
	const uvLabel = $derived(
		{
			low: m.uv_low,
			moderate: m.uv_moderate,
			high: m.uv_high,
			veryHigh: m.uv_very_high,
			extreme: m.uv_extreme
		}[uv]()
	);

	$effect(() => rememberLastPlace(place));

	let clock = $state(Date.now());
	const updated = $derived(age(forecast.fetchedAt, clock, getLocale()));

	$effect(() => {
		const tick = setInterval(() => (clock = Date.now()), 60_000);
		// A tab left in the background shows an old forecast; load it again when it comes back.
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			clock = Date.now();
			if (clock - Date.parse(forecast.fetchedAt) > STALE_AFTER_MS) invalidateAll();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(tick);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<svelte:head>
	<title>{m.weather_in({ place: name })} · SkySense</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-4 md:px-8 md:pt-8">
	<header class="flex items-center justify-between gap-2">
		<a
			href="{resolve('/')}?choose"
			class="flex h-11 min-w-0 pill items-center gap-2 px-4 text-sm font-semibold"
		>
			<MapPin size={18} class="shrink-0" aria-hidden="true" />
			<span class="truncate">{name}</span>
			<span class="sr-only">, {m.change_place()}</span>
			<ChevronDown size={16} class="shrink-0" aria-hidden="true" />
		</a>
		<div class="flex gap-2">
			{#if !savedPlaces.has(place)}
				<button
					type="button"
					class="flex h-11 pill items-center gap-1.5 px-4 text-sm font-semibold"
					onclick={() => savedPlaces.add(place)}
				>
					<Plus size={16} aria-hidden="true" />
					{m.save_place()}
				</button>
			{/if}
			<a
				href={resolve('/settings')}
				aria-label={m.settings()}
				class="grid size-11 pill place-items-center"><Settings size={18} aria-hidden="true" /></a
			>
		</div>
	</header>

	<h1 class="sr-only">{m.weather_in({ place: name })}</h1>

	<div
		class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-flow-dense md:grid-cols-4 [&>*]:min-w-0"
	>
		<section class="glass p-6 md:col-span-2 md:row-span-2 md:p-8">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-sm font-medium text-ink-muted">
						{m.now_at({ time: `${f.weekday(now.time.slice(0, 10))} ${f.time(now.time)}` })}
					</p>
					<p class="mt-2 text-8xl font-bold tracking-tight tabular-nums">{f.temp(now.temp)}</p>
					<p class="mt-1 text-lg">
						{conditionLabel(now.condition, now.isDay)} · {m.feels_like({ temp: f.temp(now.feels) })}
					</p>
				</div>
				<WeatherIcon
					condition={now.condition}
					isDay={now.isDay}
					size={88}
					strokeWidth={1.25}
					class="shrink-0 drop-shadow-[0_0_24px_rgba(251,191,36,.35)]"
				/>
			</div>
			<p class="mt-8 text-lg text-ink-muted">
				{m.high_low({ max: f.temp(today.max), min: f.temp(today.min) })}
			</p>
			<p class="mt-2 text-sm text-ink-muted">
				{updated ? m.updated_ago({ ago: updated }) : m.updated_just_now()}
			</p>
		</section>

		<section class="glass p-6 md:col-span-2">
			<UmbrellaTile hours={forecast.hours} {f} />
		</section>

		<section class="glass p-6">
			<p class="question"><Sunset size={18} aria-hidden="true" /> {m.dark_question()}</p>
			{#if dark.kind === 'sets'}
				<p class="mt-2 answer">{f.time(dark.at)}</p>
				{#if today.sunrise}<p class="mt-2 text-sm text-ink-muted">
						{m.sunrise_was({ time: f.time(today.sunrise) })}
					</p>{/if}
			{:else if dark.kind === 'dark'}
				<p class="mt-2 answer">{m.dark_now()}</p>
				{#if dark.sunrise}<p class="mt-2 text-sm text-ink-muted">
						{m.sunrise_at({ time: f.time(dark.sunrise) })}
					</p>{/if}
			{:else if dark.kind === 'polar-night'}
				<p class="mt-2 answer">{m.polar_night()}</p>
			{:else}
				<p class="mt-2 answer">{m.midnight_sun()}</p>
			{/if}
		</section>

		<section class="glass p-6">
			<p class="question"><Wind size={18} aria-hidden="true" /> {m.wind_question()}</p>
			<p class="mt-2 answer">{windAnswer}</p>
			<p class="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
				<Navigation
					size={14}
					aria-hidden="true"
					style="transform: rotate({now.windDirection + 180}deg)"
				/>
				{m.wind_detail({ speed: f.wind(now.wind), gust: f.wind(now.gust) })}
			</p>
		</section>

		<section class="glass p-5 md:col-span-4">
			<h2 class="question">{m.next_hours()}</h2>
			<HourlyStrip hours={forecast.hours.slice(0, 24)} {f} />
		</section>

		<section class="glass p-6 md:col-span-2 md:row-span-2">
			<h2 class="question">{m.ten_days()}</h2>
			<DailyList days={forecast.days} {f} />
		</section>

		<section class="glass p-6 md:col-span-2 md:row-span-2">
			<h2 class="question">{m.today_details()}</h2>
			<dl class="mt-4 grid grid-cols-2 gap-3">
				{#each [[m.uv_index(), `${Math.round(today.uvMax)} · ${uvLabel}`], [m.humidity(), f.percent(now.humidity)], [m.rain_today(), f.rain(today.rain)], [m.rain_chance_label(), f.percent(today.rainChance)], [m.sunrise(), today.sunrise ? f.time(today.sunrise) : '–'], [m.sunset(), today.sunset ? f.time(today.sunset) : '–']] as [label, value] (label)}
					<div class="rounded-2xl bg-white/5 p-4 outline-1 outline-white/10">
						<dt class="text-sm text-ink-muted">{label}</dt>
						<dd class="mt-1 text-xl font-bold tabular-nums">{value}</dd>
					</div>
				{/each}
			</dl>
			<p class="mt-4 flex items-center gap-1.5 text-sm text-ink-muted">
				<Droplets size={14} aria-hidden="true" />
				{m.rain_likely_note({ percent: f.percent(RAIN_LIKELY) })}
			</p>
		</section>
	</div>

	<SiteFooter />
</main>
