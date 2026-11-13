<script lang="ts">
	import { Umbrella, WifiOff } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { precipitation, skyKind } from '#lib/sky.js';
	import { summarize } from '#lib/summary.js';
	import { burnInShift, placeNow, upcoming } from '#lib/wall.js';
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
	class="grid min-h-dvh content-center gap-8 p-6 transition-transform duration-1000 motion-reduce:transition-none md:p-10 landscape:lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] landscape:lg:items-center landscape:lg:gap-16"
	style:transform="translate({shift.x}px, {shift.y}px)"
>
	<section>
		<h1 class="text-xl font-semibold text-ink-muted md:text-2xl">
			<a href={placeUrl} class="underline-offset-4 hover:underline">{name}</a>
		</h1>
		<p class="mt-2 text-7xl font-bold tracking-tight tabular-nums md:text-9xl" aria-live="off">
			<time datetime={local}>{f.time(local)}</time>
		</p>
		<p class="mt-1 text-lg text-ink-muted md:text-xl">{f.date(local.slice(0, 10))}</p>

		<div class="mt-8 flex items-center gap-5">
			<WeatherIcon condition={now.condition} isDay={now.isDay} size={88} strokeWidth={1.25} />
			<div>
				<p class="text-6xl font-bold tracking-tight tabular-nums md:text-7xl">{f.temp(now.temp)}</p>
				<p class="mt-1 text-lg md:text-xl">{conditionLabel(now.condition, now.isDay)}</p>
			</div>
		</div>
	</section>

	<section class="flex min-w-0 flex-col gap-5">
		<div
			class="md:[&_p]:text-[2.75rem] md:[&_p]:leading-[1.08] md:[&_p]:font-extrabold md:[&_p]:tracking-[-0.025em]"
		>
			<SummaryLine sentences={summarize(hours, now.temp)} {f} />
		</div>
		<p class="flex items-center gap-2 text-lg text-ink-muted">
			<Umbrella size={20} aria-hidden="true" />
			{rain ? m.embed_umbrella_yes() : m.embed_umbrella_no()}
		</p>
		<div class="w-fit max-w-full glass px-4 pt-1 pb-2">
			<!-- Every second hour, so the twelve fit across a tablet without scrolling. -->
			<HourlyStrip hours={everySecond} {f} label={m.next_12_hours()} />
		</div>
		{#if offline}
			<p class="flex items-center gap-2 text-sm text-ink-muted" role="status">
				<WifiOff size={16} aria-hidden="true" />
				{m.wall_offline({
					time: f.time(placeNow(forecast.utcOffsetSeconds, Date.parse(forecast.fetchedAt)))
				})}
			</p>
		{/if}
	</section>
</main>

<!-- Dims the whole screen at night; the text keeps its contrast against the darkened sky. -->
{#if night}
	<div class="pointer-events-none fixed inset-0 bg-surface/30 forced-colors:hidden"></div>
{/if}

<SkyLayer kind={sky} falling={precipitation(now.condition)} />
