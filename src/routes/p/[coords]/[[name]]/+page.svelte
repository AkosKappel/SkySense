<script lang="ts">
	import {
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		MapPin,
		Moon,
		Navigation,
		Plus,
		Settings,
		Sunset,
		TriangleAlert,
		Wind
	} from '@lucide/svelte';
	import { invalidateAll, pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ActivityTile from '#lib/components/ActivityTile.svelte';
	import AirTile from '#lib/components/AirTile.svelte';
	import DailyList from '#lib/components/DailyList.svelte';
	import DayDetail from '#lib/components/DayDetail.svelte';
	import ClimateTiles from '#lib/components/ClimateTiles.svelte';
	import CompareWith from '#lib/components/CompareWith.svelte';
	import DayFacts from '#lib/components/DayFacts.svelte';
	import ModelCompare from '#lib/components/ModelCompare.svelte';
	import YearView from '#lib/components/YearView.svelte';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import NowTile from '#lib/components/NowTile.svelte';
	import PlaceSheet from '#lib/components/PlaceSheet.svelte';
	import ShareButton from '#lib/components/ShareButton.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TempChart from '#lib/components/TempChart.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import { comfortShift } from '#lib/activities.js';
	import { airSummary } from '#lib/air.js';
	import { darkness } from '#lib/daylight.js';
	import { compass, formatter, STRONG_GUST_KMH, windLevel } from '#lib/format.js';
	import { age, STALE_AFTER_MS } from '#lib/freshness.js';
	import { isSearchShortcut } from '#lib/keys.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { moon } from '#lib/moon.js';
	import { rememberLastPlace, savedPlaces } from '#lib/places.svelte.js';
	import { precipitation, skyKind } from '#lib/sky.js';
	import { summarize } from '#lib/summary.js';
	import { whatToWear } from '#lib/wear.js';
	import { beaufort } from '#lib/units.js';
	import { formatCoordinates } from '#lib/weather.js';
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

	const windAnswer = $derived(
		{
			calm: m.wind_calm,
			light: m.wind_light,
			breezy: m.wind_breezy,
			windy: m.wind_windy,
			stormy: m.wind_stormy
		}[wind]()
	);

	// `?day=2026-11-12` shows one day; anything not in the forecast shows the overview.
	const day = $derived(forecast.days.find((d) => d.date === page.url.searchParams.get('day')));
	const comparing = $derived(page.url.searchParams.has('models'));
	const pastYear = $derived(page.url.searchParams.has('year'));
	const title = $derived(
		pastYear
			? m.year_title({ place: name })
			: comparing
				? m.compare_title({ place: name })
				: day
					? m.weather_on({ place: name, date: f.date(day.date) })
					: m.weather_in({ place: name })
	);
	const dayHours = $derived(day ? forecast.hours.filter((h) => h.time.startsWith(day.date)) : []);

	// The scrubbed hour on the overview; 0 is now.
	let scrubbed = $state(0);
	// A new place or a reloaded forecast starts at now again.
	$effect.pre(() => {
		void forecast;
		scrubbed = 0;
	});

	// A day view shows that day's sky at noon; the overview shows the sky at the scrubbed hour.
	const skyAt = $derived(
		day
			? (dayHours.find((h) => h.time.endsWith('T12:00')) ?? {
					time: `${day.date}T12:00`,
					isDay: true,
					condition: day.condition
				})
			: scrubbed > 0
				? forecast.hours[scrubbed]
				: now
	);
	const sky = $derived(
		skyKind(skyAt, forecast.days.find((d) => skyAt.time.startsWith(d.date)) ?? today)
	);

	const air = $derived(airSummary(forecast.hours.slice(0, 24)));

	// Tonight's moon, at 22:00 local time (H-05).
	const tonight = $derived(moon(`${today.date}T22:00`));
	const moonPhase = $derived(
		{
			new: m.moon_new,
			waxingCrescent: m.moon_waxingCrescent,
			firstQuarter: m.moon_firstQuarter,
			waxingGibbous: m.moon_waxingGibbous,
			full: m.moon_full,
			waningGibbous: m.moon_waningGibbous,
			lastQuarter: m.moon_lastQuarter,
			waningCrescent: m.moon_waningCrescent
		}[tonight.phase]()
	);

	const direction = $derived(
		{
			n: m.wind_from_n,
			ne: m.wind_from_ne,
			e: m.wind_from_e,
			se: m.wind_from_se,
			s: m.wind_from_s,
			sw: m.wind_from_sw,
			w: m.wind_from_w,
			nw: m.wind_from_nw
		}[compass(now.windDirection)]()
	);
	const strongestGust = $derived(
		Math.max(now.gust, ...forecast.hours.slice(0, 12).map((h) => h.gust))
	);

	$effect(() => rememberLastPlace(place));

	// Previous and next saved place (F-21), in the list's order and round the end.
	const neighbours = $derived.by(() => {
		const list = savedPlaces.list;
		const at = list.findIndex((p) => formatCoordinates(p) === formatCoordinates(place));
		if (at === -1 || list.length < 2) return null;
		const link = (p: (typeof list)[number]) => {
			const label = p.live ? m.my_location() : p.name;
			return {
				label,
				href: resolve('/p/[coords]/[[name]]', {
					coords: formatCoordinates(p),
					name: encodeURIComponent(label)
				})
			};
		};
		return {
			previous: link(list[(at - 1 + list.length) % list.length]),
			next: link(list[(at + 1) % list.length])
		};
	});

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

<svelte:window
	onkeydown={(event) => {
		// With the sheet open, the search inside it takes the shortcut.
		if (page.state.placeSheet || !isSearchShortcut(event)) return;
		event.preventDefault();
		pushState('', { placeSheet: 'search' });
	}}
/>

<svelte:head>
	<title>{title} · SkySense</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pt-4 md:px-8 md:pt-8">
	<header class="flex items-center justify-between gap-2">
		<a
			href="{resolve('/')}?choose"
			onclick={(event) => {
				// Without JavaScript the link still opens the home page chooser.
				event.preventDefault();
				pushState('', { placeSheet: true });
			}}
			aria-haspopup="dialog"
			class="flex h-11 min-w-0 pill items-center gap-2 px-4 text-sm font-semibold"
		>
			<MapPin size={18} class="shrink-0" aria-hidden="true" />
			<span class="truncate">{name}</span>
			<span class="sr-only">, {m.change_place()}</span>
			<ChevronDown size={16} class="shrink-0" aria-hidden="true" />
		</a>
		<div class="flex gap-2">
			{#if neighbours}
				<a
					href={neighbours.previous.href}
					aria-label={m.previous_place({ name: neighbours.previous.label })}
					class="grid size-11 pill place-items-center"
					><ChevronLeft size={18} aria-hidden="true" /></a
				>
				<a
					href={neighbours.next.href}
					aria-label={m.next_place({ name: neighbours.next.label })}
					class="grid size-11 pill place-items-center"
					><ChevronRight size={18} aria-hidden="true" /></a
				>
			{/if}
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
			<ShareButton {title} />
			<a
				href={resolve('/settings')}
				aria-label={m.settings()}
				class="grid size-11 pill place-items-center"><Settings size={18} aria-hidden="true" /></a
			>
		</div>
	</header>

	{#if pastYear}
		<YearView year={data.year} place={name} {f} />
	{:else if comparing}
		<ModelCompare runs={data.models} from={forecast.hours[0].time} {f} />
	{:else if day}
		<DayDetail {day} hours={dayHours} isToday={day.date === today.date} {f} />
	{:else}
		<h1 class="sr-only">{m.weather_in({ place: name })}</h1>

		<section class="mt-5 px-1" aria-label={m.summary_label()}>
			<SummaryLine sentences={summarize(forecast.hours, now.temp)} {f} />
		</section>

		<div
			class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-flow-dense md:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0"
		>
			{#if air.air || air.pollen}
				<section class="glass p-5 md:col-span-2 lg:col-span-4">
					<AirTile summary={air} {f} />
				</section>
			{/if}

			<section class="glass p-6 md:col-span-2 md:p-8 lg:row-span-2">
				<NowTile
					{now}
					hours={forecast.hours.slice(0, 49)}
					days={forecast.days}
					{f}
					{updated}
					place={name}
					utcOffsetSeconds={forecast.utcOffsetSeconds}
					wear={whatToWear(forecast.hours, comfortShift[data.comfort])}
					bind:selected={scrubbed}
				/>
			</section>

			<section class="glass p-6 md:col-span-2">
				<UmbrellaTile hours={forecast.hours} {f} />
			</section>

			<section class="glass p-6 md:col-span-2 lg:col-span-4">
				<ActivityTile
					hours={forecast.hours.slice(0, 24)}
					week={forecast.hours}
					place={name}
					utcOffsetSeconds={forecast.utcOffsetSeconds}
					days={forecast.days}
					{f}
					comfort={data.comfort}
				/>
			</section>

			<section class="glass p-5 md:col-span-2 lg:col-span-4">
				<h2 class="question">{m.next_hours()}</h2>
				<HourlyStrip hours={forecast.hours.slice(0, 24)} {f} />
			</section>

			<section class="glass p-6 md:col-span-2 lg:col-span-4">
				<TempChart hours={forecast.hours.slice(0, 25)} {f} />
				<a
					href="{resolve('/p/[coords]/[[name]]', {
						coords: page.params.coords ?? '',
						name: encodeURIComponent(page.params.name ?? '')
					})}?models"
					class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
					>{m.compare_models()} <ChevronRight size={16} aria-hidden="true" /></a
				>
			</section>

			<!-- After the activities on a phone (docs/design.md); the dense grid still puts them beside
				the umbrella on wider screens. -->
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
				<p class="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
					<Moon size={14} aria-hidden="true" />
					{m.moon_line({ phase: moonPhase, percent: f.percent(tonight.illumination * 100) })}
				</p>
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
					{direction} · {m.wind_detail({ speed: f.wind(now.wind), gust: f.wind(now.gust) })}
				</p>
				{#if strongestGust >= STRONG_GUST_KMH}
					<p class="mt-3 flex items-start gap-1.5 text-sm font-semibold text-sun">
						<TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
						{m.wind_gust_warning({ gust: f.wind(strongestGust) })}
					</p>
				{/if}
			</section>

			<section class="glass p-6 lg:col-span-2 lg:row-span-2">
				<h2 class="question">{m.ten_days()}</h2>
				<DailyList days={forecast.days} hours={forecast.hours} {f} />
				<CompareWith current={place} />
			</section>

			<section class="glass p-6 lg:col-span-2 lg:row-span-2">
				<h2 class="question">{m.today_details()}</h2>
				<DayFacts day={today} {f} humidity={now.humidity} />
			</section>

			<ClimateTiles
				coordinates={data.coordinates}
				date={today.date}
				max={today.max}
				place={name}
				{f}
			/>
		</div>
	{/if}

	<SiteFooter />
</main>

<SkyLayer kind={sky} falling={precipitation(skyAt.condition)} />
<PlaceSheet current={data.coordinates} />
