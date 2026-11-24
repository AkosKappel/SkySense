<script lang="ts">
	import {
		Droplets,
		Sun,
		Sunrise,
		Sunset,
		Thermometer,
		Umbrella,
		WifiOff,
		Wind
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import TomorrowTile from '#lib/components/TomorrowTile.svelte';
	import WallCustomize from '#lib/components/WallCustomize.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel, tomorrowText } from '#lib/components/labels.js';
	import { formatter, uvLevel } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { precipitation, skyKind } from '#lib/sky.js';
	import { summarize } from '#lib/summary.js';
	import { tomorrowOutlook } from '#lib/tomorrow.js';
	import {
		burnInShift,
		heroBlocks,
		isEvening,
		placeNow,
		upcoming,
		wallLayout,
		type WallBlock
	} from '#lib/wall.js';
	import { formatCoordinates, nextRain, type Forecast } from '#lib/weather.js';
	import type { PageProps } from './$types';

	// A page for a tablet or an old phone left on all day (F-25): big clock and now, the next
	// hours and the day's sentence. It reloads every 10 minutes and keeps the last forecast when
	// the network is gone, keeps the screen on, turns dark and dim at night and moves a few
	// pixels every hour against burn-in.
	let { data }: PageProps = $props();

	const REFRESH_MS = 10 * 60 * 1000;
	const HOUR_MS = 60 * 60 * 1000;

	let latest = $state<Forecast | null>(null);
	let offline = $state(false);
	let clock = $state(Date.now());

	const forecast = $derived(latest ?? data.forecast);
	const f = $derived(formatter(getLocale(), data.units));
	const name = $derived(data.name ?? m.unnamed_place());
	const local = $derived(placeNow(forecast.utcOffsetSeconds, clock));
	const hours = $derived(upcoming(forecast.hours, local));
	// Without a fresh reading, the forecast for this hour stands in for "now".
	const now = $derived(
		clock - Date.parse(forecast.fetchedAt) < HOUR_MS
			? forecast.current
			: (hours[0] ?? forecast.current)
	);
	const today = $derived(forecast.days.find((d) => local.startsWith(d.date)) ?? forecast.days[0]);
	const sky = $derived(skyKind(now, today));
	const rain = $derived(nextRain(hours, 24));
	const everySecond = $derived(hours.slice(0, 13).filter((_, i) => i % 2 === 0));
	// From the place's sunset to its sunrise; in polar night or midnight sun, the hour's own flag.
	const night = $derived(
		today.sunrise && today.sunset ? local < today.sunrise || local >= today.sunset : !now.isDay
	);
	const shift = $derived(burnInShift(Number(local.slice(11, 13))));

	// What this screen shows (F-31), from its address; the big column only when both have blocks.
	const layout = $derived(wallLayout(page.url.searchParams));
	const shows = (block: WallBlock) => layout.blocks.includes(block);
	const hero = $derived(layout.blocks.some((b) => heroBlocks.includes(b)));
	const side = $derived(layout.blocks.some((b) => !heroBlocks.includes(b)));
	// Zoom scales lengths inside the page too, so its full height is divided back out below.
	const zoom = $derived({ s: 0.8, m: 1, l: 1.25 }[layout.size]);
	// From sunset on, the sentence answers for tomorrow; beside the tomorrow tile it would repeat it.
	const days = $derived(forecast.days.slice(Math.max(0, forecast.days.indexOf(today))));
	const outlook = $derived(tomorrowOutlook(days, forecast.hours));
	const evening = $derived(isEvening(local, today.sunset) && outlook !== null);
	// The readings people glance at from across the room; the sun times only where the sun rises.
	const readings = $derived([
		{ Icon: Thermometer, label: m.feels_like_line(), value: f.temp(now.feels) },
		// An hour from the forecast standing in for now has no humidity.
		...('humidity' in now
			? [{ Icon: Droplets, label: m.humidity(), value: f.percent(now.humidity) }]
			: []),
		{ Icon: Wind, label: m.wind_speed(), value: f.wind(now.wind) },
		{
			Icon: Sun,
			label: m.uv_index(),
			value: `${Math.round(today.uvMax)} · ${{ low: m.uv_low, moderate: m.uv_moderate, high: m.uv_high, veryHigh: m.uv_very_high, extreme: m.uv_extreme }[uvLevel(today.uvMax)]()}`
		},
		...(today.sunrise ? [{ Icon: Sunrise, label: m.sunrise(), value: f.time(today.sunrise) }] : []),
		...(today.sunset ? [{ Icon: Sunset, label: m.sunset(), value: f.time(today.sunset) }] : [])
	]);
	const placeUrl = $derived(
		resolve('/p/[coords]/[[name]]', {
			coords: formatCoordinates(data.coordinates),
			name: encodeURIComponent(name)
		})
	);

	async function refresh() {
		const { lat, lon } = data.coordinates;
		try {
			const response = await fetch(`/api/forecast?lat=${lat}&lon=${lon}`);
			if (!response.ok) throw new Error(`Forecast answered ${response.status}`);
			latest = (await response.json()) as Forecast;
			offline = false;
		} catch {
			offline = true;
		}
	}

	$effect(() => {
		const tick = setInterval(() => (clock = Date.now()), 15_000);
		const reload = setInterval(refresh, REFRESH_MS);
		addEventListener('online', refresh);
		return () => {
			clearInterval(tick);
			clearInterval(reload);
			removeEventListener('online', refresh);
		};
	});

	// The browser drops the wake lock whenever the tab is hidden, so it is asked for again on return.
	$effect(() => {
		if (!('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		const request = async () => {
			if (document.visibilityState !== 'visible') return;
			lock = await navigator.wakeLock.request('screen').catch(() => null);
		};
		request();
		document.addEventListener('visibilitychange', request);
		return () => {
			document.removeEventListener('visibilitychange', request);
			lock?.release();
		};
	});

	// After sunset the page goes dark whatever the theme, so the screen does not light the room.
	$effect(() => {
		if (!night) return;
		const root = document.documentElement;
		const before = root.dataset.theme;
		root.dataset.theme = 'dark';
		return () => {
			if (before) root.dataset.theme = before;
		};
	});
</script>

<svelte:head>
	<title>{m.weather_in({ place: name })} · SkySense</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class={[
		'mx-auto grid w-full max-w-3xl content-center gap-8 p-6 md:p-10',
		hero &&
			side &&
			'landscape:lg:max-w-7xl landscape:lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] landscape:lg:items-center landscape:lg:gap-16'
	]}
	style:zoom
	style:min-height="calc(100dvh / {zoom})"
>
	<!-- The shift stays inside the page padding, so it never makes the page scroll. -->
	<section style:translate="{shift.x}px {shift.y}px" class={hero ? undefined : 'sr-only'}>
		<h1 class="text-xl font-semibold text-ink-muted md:text-2xl">
			<a href={placeUrl} class="underline-offset-4 hover:underline">{name}</a>
		</h1>
		{#if shows('clock')}
			<!-- Sized to the screen so "12:24 PM" stays on one line beside the other column, and
			     larger when the clock has the screen to itself. -->
			<p
				class={[
					'mt-2 leading-none font-bold tracking-tight whitespace-nowrap tabular-nums',
					side
						? 'text-[clamp(3.5rem,15vw,8rem)] landscape:lg:text-[clamp(4rem,8vw,8rem)]'
						: 'text-[clamp(4rem,min(20vw,32dvh),13rem)]'
				]}
				aria-live="off"
			>
				<time datetime={local}>{f.time(local)}</time>
			</p>
		{/if}
		{#if shows('date')}
			<p class="mt-1 text-lg text-ink-muted md:text-xl">{f.date(local.slice(0, 10))}</p>
		{/if}

		{#if shows('now')}
			<div class="mt-8 flex items-center gap-5">
				<WeatherIcon
					condition={now.condition}
					isDay={now.isDay}
					size={88}
					strokeWidth={1.25}
					halo
				/>
				<div>
					<p class="text-6xl font-bold tracking-tight tabular-nums md:text-7xl">
						{f.temp(now.temp)}
					</p>
					<p class="mt-1 text-lg md:text-xl">{conditionLabel(now.condition, now.isDay)}</p>
				</div>
			</div>
		{/if}
	</section>

	{#if side}
		<section class="flex min-w-0 flex-col gap-5" style:translate="{shift.x}px {shift.y}px">
			{#if shows('sentence') && !(evening && shows('tomorrow'))}
				<div
					class="md:[&_p]:text-[2.75rem] md:[&_p]:leading-[1.08] md:[&_p]:font-extrabold md:[&_p]:tracking-[-0.025em]"
				>
					{#if evening && outlook}
						<p class="text-lg font-semibold text-ink-muted md:text-xl!">
							{m.tomorrow_question()}
						</p>
						<p class="mt-1 text-3xl font-extrabold">{tomorrowText(outlook, f)}</p>
					{:else}
						<SummaryLine sentences={summarize(hours, now.temp)} {f} />
					{/if}
				</div>
			{/if}
			{#if shows('umbrella')}
				<p class="flex items-center gap-2 text-lg text-ink-muted">
					<Umbrella size={20} aria-hidden="true" />
					{rain ? m.embed_umbrella_yes() : m.embed_umbrella_no()}
				</p>
			{/if}
			{#if shows('readings')}
				<dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{#each readings as { Icon, label, value } (label)}
						<div class="glass px-4 py-3">
							<dt class="flex items-center gap-1.5 text-sm text-ink-muted">
								<Icon size={16} aria-hidden="true" />
								{label}
							</dt>
							<dd class="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
						</div>
					{/each}
				</dl>
			{/if}
			{#if shows('hours')}
				<div class="glass px-4 pt-1 pb-2">
					<!-- Every second hour, so the twelve fit across a tablet without scrolling. -->
					<HourlyStrip hours={everySecond} {f} label={m.next_12_hours()} />
				</div>
			{/if}
			{#if shows('tomorrow')}
				<TomorrowTile {days} hours={forecast.hours} {f} />
			{/if}
		</section>
	{/if}
	{#if offline}
		<p
			class="flex items-center gap-2 text-sm text-ink-muted landscape:lg:col-span-full"
			role="status"
		>
			<WifiOff size={16} aria-hidden="true" />
			{m.wall_offline({
				time: f.time(placeNow(forecast.utcOffsetSeconds, Date.parse(forecast.fetchedAt)))
			})}
		</p>
	{/if}
</main>

<WallCustomize {layout} />

<!-- Dims the whole screen at night; the text keeps its contrast against the darkened sky. -->
{#if night}
	<div class="pointer-events-none fixed inset-0 bg-surface/30 forced-colors:hidden"></div>
{/if}

<SkyLayer kind={sky} falling={precipitation(now.condition)} />
