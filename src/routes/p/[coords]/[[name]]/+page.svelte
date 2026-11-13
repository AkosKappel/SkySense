<script lang="ts">
	import {
		ArrowLeft,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		MapPin,
		Moon,
		Navigation,
		Plus,
		Settings,
		Sunset,
		Tablet,
		TriangleAlert,
		Wind
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { invalidateAll, pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ActivityTile from '#lib/components/ActivityTile.svelte';
	import AirTile from '#lib/components/AirTile.svelte';
	import DailyList from '#lib/components/DailyList.svelte';
	import DayDetail from '#lib/components/DayDetail.svelte';
	import ClimateTiles from '#lib/components/ClimateTiles.svelte';
	import DryTile from '#lib/components/DryTile.svelte';
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
	import ShareCardButton from '#lib/components/ShareCardButton.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import { summaryText } from '#lib/components/summary-text.js';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import { activities, bestWindow, comfortShift } from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import { activityLabel, conditionLabel } from '#lib/components/labels.js';
	import type { ShareCard } from '#lib/share-card.js';
	import { airSummary } from '#lib/air.js';
	import { darkness } from '#lib/daylight.js';
	import { compass, formatter, STRONG_GUST_KMH, windLevel } from '#lib/format.js';
	import { age, STALE_AFTER_MS } from '#lib/freshness.js';
	import { isSearchShortcut } from '#lib/keys.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { moon } from '#lib/moon.js';
	import { MAX_PLACES, pageName, rememberLastPlace, savedPlaces } from '#lib/places.svelte.js';
	import { precipitation, skies, skyKind } from '#lib/sky.js';
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
	const showRadar = $derived(page.url.searchParams.has('radar'));
	const showBetter = $derived(page.url.searchParams.has('better'));
	const title = $derived(
		showRadar
			? m.radar_title({ place: name })
			: pastYear
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

	// "Share today as a picture" (X-04): what the page says, in one square.
	function shareCard(): ShareCard {
		const first = activityChoice.list[0];
		const best = first
			? bestWindow(
					activities[first],
					forecast.hours.slice(0, 24),
					forecast.days,
					comfortShift[data.comfort]
				).window
			: null;
		return {
			place: name,
			date: f.date(today.date),
			temp: f.temp(now.temp),
			condition: conditionLabel(now.condition, now.isDay),
			highLow: m.high_low({ max: f.temp(today.max), min: f.temp(today.min) }),
			summary: summaryText(summarize(forecast.hours, now.temp), f),
			best:
				first && best
					? m.share_best({
							activity: activityLabel(first),
							range: m.window_range({ from: f.time(best.from), until: f.time(best.until) })
						})
					: null,
			footer: m.share_footer(),
			sky: skies[skyKind(now, today)].stops
		};
	}

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

	// Saving into a full list does nothing but say so (no place is dropped to make room).
	let placesFull = $state(false);

	// Served from the offline copy (P-01): say so; the age of the forecast is in the now tile.
	let offline = $state(false);
	onMount(() => {
		const update = () => (offline = !navigator.onLine);
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	// Previous and next saved place (F-21), in the list's order and round the end. Hidden below
	// 380 px, where they would squeeze the place name out of the header; the sheet still lists all.
	const neighbours = $derived.by(() => {
		const list = savedPlaces.list;
		const at = list.findIndex((p) => formatCoordinates(p) === formatCoordinates(place));
		if (at === -1 || list.length < 2) return null;
		const link = (p: (typeof list)[number]) => {
			const label = pageName(p);
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

<main class="mx-auto flex min-h-dvh max-w-[88rem] flex-col px-4 pt-4 md:px-8 md:pt-8">
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
					class="hidden size-11 pill place-items-center min-[380px]:grid"
					><ChevronLeft size={18} aria-hidden="true" /></a
				>
				<a
					href={neighbours.next.href}
					aria-label={m.next_place({ name: neighbours.next.label })}
					class="hidden size-11 pill place-items-center min-[380px]:grid"
					><ChevronRight size={18} aria-hidden="true" /></a
				>
			{/if}
			{#if !savedPlaces.has(place)}
				<button
					type="button"
					class="flex h-11 pill items-center gap-1.5 px-4 text-sm font-semibold"
					onclick={() => (placesFull = !savedPlaces.add(place))}
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
	{#if offline}
		<p role="status" class="mt-3 glass px-5 py-3 text-sm font-semibold">{m.offline_notice()}</p>
	{/if}
	{#if placesFull}
		<p role="status" class="mt-3 glass px-5 py-3 text-sm font-semibold">
			{m.places_full({ max: MAX_PLACES })}
		</p>
	{/if}

	{#if showRadar}
		<!-- The map is built once on mount, so another place's radar needs a fresh one. The view
		     loads on demand: it needs the browser anyway, and it stays out of every forecast page. -->
		<!-- The radar's header is here, not in the view, so the page has its heading before the view
		     has loaded (and without JavaScript). -->
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
			<h1 class="text-2xl font-extrabold">{m.radar_title({ place: name })}</h1>
		</div>
		{#key formatCoordinates(data.coordinates)}
			{#await import('#lib/components/RadarView.svelte') then { default: RadarView }}
				<RadarView
					coordinates={data.coordinates}
					place={name}
					utcOffsetSeconds={forecast.utcOffsetSeconds}
					{f}
				/>
			{/await}
		{/key}
	{:else if showBetter}
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
			<h1 class="text-2xl font-extrabold">{m.better_title({ place: name })}</h1>
		</div>
		{#key formatCoordinates(data.coordinates)}
			{#await import('#lib/components/BetterView.svelte') then { default: BetterView }}
				<BetterView
					coordinates={data.coordinates}
					place={name}
					days={forecast.days.slice(0, 7)}
					now={now.time}
					{f}
					comfort={data.comfort}
				/>
			{/await}
		{/key}
	{:else if pastYear}
		<YearView year={data.year} place={name} {f} />
	{:else if comparing}
		<ModelCompare runs={data.models} from={forecast.hours[0].time} {f} />
	{:else if day}
		<DayDetail
			{day}
			hours={dayHours}
			days={forecast.days}
			isToday={day.date === today.date}
			{f}
			comfort={data.comfort}
		/>
	{:else}
		<h1 class="sr-only">{m.weather_in({ place: name })}</h1>

		<!-- From 1280 px: the answer and now stay on the left while the evidence scrolls on the right.
		     Pinned only when the window is tall enough to show the whole column. -->
		<div class="xl:grid xl:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
			<aside
				class="flex min-w-0 flex-col gap-4 xl:top-8 xl:[@media(min-height:56rem)]:sticky"
				aria-label={m.summary_label()}
			>
				<section class="mt-5 px-1 xl:mt-6 xl:mb-2">
					<SummaryLine sentences={summarize(forecast.hours, now.temp)} {f} large />
					<div class="flex flex-wrap gap-x-5">
						<ShareCardButton card={shareCard} filename="skysense-{today.date}.png" />
						<a
							href={resolve('/wall/[coords]/[[name]]', {
								coords: page.params.coords ?? '',
								name: encodeURIComponent(page.params.name ?? '')
							})}
							class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
						>
							<Tablet size={16} aria-hidden="true" />
							{m.wall_link()}
						</a>
					</div>
				</section>

				<section class="glass p-6 md:p-8">
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

				{#if air.air || air.pollen}
					<section class="glass p-5">
						<AirTile summary={air} {f} />
					</section>
				{/if}
			</aside>

			<div
				class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-flow-dense md:grid-cols-2 xl:mt-6 [&>*]:min-w-0"
			>
				<section class="flex flex-col glass p-6">
					<UmbrellaTile hours={forecast.hours} {f} />
					<a
						href="{resolve('/p/[coords]/[[name]]', {
							coords: page.params.coords ?? '',
							name: encodeURIComponent(page.params.name ?? '')
						})}?radar"
						class="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-sm font-semibold underline-offset-4 hover:underline"
						>{m.radar_link()} <ChevronRight size={16} aria-hidden="true" /></a
					>
				</section>

				<section class="glass p-6">
					<ActivityTile
						hours={forecast.hours.slice(0, 24)}
						week={forecast.hours}
						place={name}
						timeZone={forecast.timezone}
						days={forecast.days}
						{f}
						comfort={data.comfort}
					/>
					<a
						href="{resolve('/p/[coords]/[[name]]', {
							coords: page.params.coords ?? '',
							name: encodeURIComponent(page.params.name ?? '')
						})}?better"
						class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
						>{m.better_link()} <ChevronRight size={16} aria-hidden="true" /></a
					>
				</section>

				<section class="glass p-5 md:col-span-2">
					<h2 class="question">{m.next_hours()}</h2>
					<HourlyStrip hours={forecast.hours.slice(0, 24)} {f} />
				</section>

				<section class="glass p-6 md:col-span-2">
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

				<!-- Wide screens: the tiles below differ a lot in height, so they flow in two balanced columns
				     instead of grid rows that stretch the short ones. Narrower screens keep the grid order. -->
				<div
					class="contents lg:col-span-2 lg:block lg:columns-2 lg:gap-4 lg:[&>*]:mb-4 lg:[&>*]:break-inside-avoid"
				>
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

					<section class="glass p-6">
						<h2 class="question">{m.ten_days()}</h2>
						<DailyList days={forecast.days} hours={forecast.hours} {f} />
						<CompareWith current={place} />
					</section>

					<section class="glass p-6">
						<h2 class="question">{m.today_details()}</h2>
						<DayFacts
							day={today}
							{f}
							humidity={now.humidity}
							pressure={now.pressure}
							ahead={forecast.hours}
						/>
					</section>

					<ClimateTiles
						coordinates={data.coordinates}
						date={today.date}
						max={today.max}
						place={name}
						{f}
					>
						<DryTile coordinates={data.coordinates} today={today.date} {f} />
					</ClimateTiles>
				</div>
			</div>
		</div>
	{/if}

	<SiteFooter />
</main>

<SkyLayer kind={sky} falling={precipitation(skyAt.condition)} />
<PlaceSheet current={data.coordinates} />
