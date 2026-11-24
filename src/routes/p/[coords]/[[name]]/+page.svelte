<script lang="ts">
	import {
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		LayoutGrid,
		Map as MapIcon,
		MapPin,
		Plus,
		Settings,
		Sparkles,
		Tablet,
		TriangleAlert,
		Waves,
		Wind
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { invalidateAll, pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ActivityTile from '#lib/components/ActivityTile.svelte';
	import AirTile from '#lib/components/AirTile.svelte';
	import DailyList from '#lib/components/DailyList.svelte';
	import DayDetail from '#lib/components/DayDetail.svelte';
	import WhenNear from '#lib/components/WhenNear.svelte';
	import WindDial from '#lib/components/WindDial.svelte';
	import TomorrowTile from '#lib/components/TomorrowTile.svelte';
	import CompareWith from '#lib/components/CompareWith.svelte';
	import DayFacts from '#lib/components/DayFacts.svelte';
	import HourlyStrip from '#lib/components/HourlyStrip.svelte';
	import NowTile from '#lib/components/NowTile.svelte';
	import type TileControls from '#lib/components/TileControls.svelte';
	import type TileEditBar from '#lib/components/TileEditBar.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import {
		defaultTiles,
		moveTile,
		stepTile,
		TILES_COOKIE,
		updateTile,
		writeTiles,
		type Tile,
		type TileId
	} from '#lib/tiles.js';
	import ShareButton from '#lib/components/ShareButton.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TempChart from '#lib/components/TempChart.svelte';
	import ShareCardButton from '#lib/components/ShareCardButton.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import { commuteCheck } from '#lib/commute.js';
	import { holidayLine } from '#lib/holidays.js';
	import { seaState } from '#lib/sea.js';
	import { summaryText } from '#lib/components/summary-text.js';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import UmbrellaTile from '#lib/components/UmbrellaTile.svelte';
	import { activities, bestWindow, comfortShift } from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import { activityLabel, conditionLabel } from '#lib/components/labels.js';
	import type { ShareCard } from '#lib/share-card.js';
	import { airSummary } from '#lib/air.js';
	import { compass, formatter, STRONG_GUST_KMH, windLevel } from '#lib/format.js';
	import { age, STALE_AFTER_MS } from '#lib/freshness.js';
	import { isSearchShortcut } from '#lib/keys.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
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
	const commute = $derived(commuteCheck(forecast.hours, now.time, data.commute));
	const holiday = $derived(holidayLine(forecast.holidays, today.date, getLocale()));
	const name = $derived(data.name ?? m.unnamed_place());
	const place = $derived({ name, ...data.coordinates });
	// The place sheet and its search load when first opened, outside the page's script budget, and
	// stay mounted after, so closing it returns focus to where it was.
	let sheetUsed = $state(false);
	$effect(() => {
		if (page.state.placeSheet) sheetUsed = true;
	});
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

	// The reader's tile layout (U-26, U-27): from the cookie on the server, changed here in the edit
	// mode. The edit controls load on first use, so a visit that never arranges pays nothing.
	let tiles = $derived(data.tiles);
	const shownTiles = $derived(tiles.filter((t) => !t.hidden));
	let editing = $state(false);
	let editor = $state<{ Controls: typeof TileControls; EditBar: typeof TileEditBar }>();
	async function startEditing() {
		const [controls, bar] = await Promise.all([
			import('#lib/components/TileControls.svelte'),
			import('#lib/components/TileEditBar.svelte')
		]);
		editor = { Controls: controls.default, EditBar: bar.default };
		editing = true;
	}
	function saveTiles(next: Tile[]) {
		tiles = next;
		document.cookie = `${TILES_COOKIE}=${encodeURIComponent(writeTiles(next))}; path=/; max-age=34560000; samesite=lax`;
	}

	// `?day=2026-11-12` shows one day; anything not in the forecast shows the overview.
	const day = $derived(forecast.days.find((d) => d.date === page.url.searchParams.get('day')));
	const comparing = $derived(page.url.searchParams.has('models'));
	const showHistory = $derived(page.url.searchParams.has('history'));
	const showRadar = $derived(page.url.searchParams.has('radar'));
	const showBetter = $derived(page.url.searchParams.has('better'));
	const showWeek = $derived(page.url.searchParams.has('week'));
	const title = $derived(
		showRadar
			? m.radar_title({ place: name })
			: showBetter
				? m.better_title({ place: name })
				: showWeek
					? m.week_title({ place: name })
					: showHistory
						? m.history_title({ place: name })
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
	// Today's waves at coastal places (X-18), with the wind that raises them.
	const sea = $derived.by(() => {
		if (!forecast.sea) return null;
		const { height, time } = forecast.sea.highest;
		const values = { height: f.waves(height), time: f.time(time) };
		return {
			calm: m.sea_calm,
			slight: m.sea_slight,
			moderate: m.sea_moderate,
			rough: m.sea_rough,
			veryRough: m.sea_very_rough
		}[seaState(height)](values);
	});
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
		<div class="flex gap-2 print:hidden">
			{#if neighbours}
				<a
					href={neighbours.previous.href}
					aria-label={m.previous_place({ name: neighbours.previous.label })}
					title={m.previous_place({ name: neighbours.previous.label })}
					class="hidden size-11 pill place-items-center min-[380px]:grid"
				>
					<ChevronLeft size={18} aria-hidden="true" />
				</a>
				<a
					href={neighbours.next.href}
					aria-label={m.next_place({ name: neighbours.next.label })}
					title={m.next_place({ name: neighbours.next.label })}
					class="hidden size-11 pill place-items-center min-[380px]:grid"
				>
					<ChevronRight size={18} aria-hidden="true" />
				</a>
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
			<!-- The map was only in the footer; a page of its own (MapLibre), so a full load. -->
			<a
				href={resolve('/map/[coords]/[[name]]', {
					coords: page.params.coords ?? '',
					name: encodeURIComponent(page.params.name ?? '')
				})}
				data-sveltekit-reload
				aria-label={m.map_link()}
				title={m.map_link()}
				class="grid size-11 pill place-items-center"
			>
				<MapIcon size={18} aria-hidden="true" />
			</a>
			<a
				href={resolve('/settings')}
				aria-label={m.settings()}
				title={m.settings()}
				class="grid size-11 pill place-items-center"
			>
				<Settings size={18} aria-hidden="true" />
			</a>
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
		<ViewHeader title={m.radar_title({ place: name })} />
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
		<ViewHeader title={m.better_title({ place: name })} />
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
	{:else if showWeek}
		<ViewHeader title={m.week_title({ place: name })} />
		{#await import('#lib/components/WeekView.svelte') then { default: WeekView }}
			<WeekView days={forecast.days} hours={forecast.hours} {f} comfort={data.comfort} />
		{/await}
	{:else if showHistory}
		<ViewHeader title={m.history_title({ place: name })} />
		{#await import('#lib/components/HistoryView.svelte') then { default: HistoryView }}
			<HistoryView
				coordinates={data.coordinates}
				today={forecast.days[0].date}
				elevation={forecast.elevation}
				{f}
			/>
		{/await}
	{:else if comparing}
		<ViewHeader title={m.compare_models()} />
		{#await import('#lib/components/ModelCompare.svelte') then { default: ModelCompare }}
			<ModelCompare runs={data.models} from={forecast.hours[0].time} {f} />
		{/await}
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
		     Only on windows tall enough to pin the whole column; shorter ones get the full-width grid,
		     as a column that scrolls away would leave the left side empty. -->
		<div
			class="xl:[@media(min-height:56rem)]:grid xl:[@media(min-height:56rem)]:grid-cols-[minmax(24rem,28rem)_minmax(0,1fr)] xl:[@media(min-height:56rem)]:items-start xl:[@media(min-height:56rem)]:gap-8"
		>
			<aside
				class="flex min-w-0 flex-col gap-4 xl:top-8 xl:[@media(min-height:56rem)]:sticky"
				aria-label={m.summary_label()}
			>
				<section class="mt-5 px-1 xl:mt-6 xl:mb-2">
					{#if holiday}
						<p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
							<Sparkles size={16} class="shrink-0" aria-hidden="true" />
							{holiday.when === 'today'
								? m.holiday_today({ name: holiday.name })
								: m.holiday_tomorrow({ name: holiday.name })}
						</p>
					{/if}
					<SummaryLine sentences={summarize(forecast.hours, now.temp)} {f} large />
					<div class="flex flex-wrap gap-x-5 print:hidden">
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

			<div class="min-w-0">
				{#if editing}<p class="mt-4 px-1 text-sm text-ink-muted xl:mt-6">{m.tiles_help()}</p>{/if}
				<!-- The reader's order and widths (U-26, U-27). Rows stretch their shorter tile, so any
				     arrangement keeps straight edges; the dense flow fills a gap a full-width tile leaves. -->
				<div
					class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-flow-dense md:grid-cols-2 xl:mt-6"
				>
					{#each shownTiles as tile, i (tile.id)}
						<div
							data-tile={tile.id}
							animate:flip={{ duration: prefersReducedMotion.current ? 0 : 200 }}
							class={[
								'relative min-w-0',
								tile.wide && 'md:col-span-2',
								tile.id === 'past'
									? ['grid content-start gap-4', tile.wide && 'md:grid-cols-2']
									: '[&>section]:h-full',
								editing &&
									'rounded-3xl pt-14 outline-2 outline-offset-4 outline-veil/25 outline-dashed'
							]}
						>
							{#if editing && editor}
								<editor.Controls
									{tile}
									first={i === 0}
									last={i === shownTiles.length - 1}
									onstep={(step) => saveTiles(stepTile(tiles, tile.id, step))}
									onmove={(to) => saveTiles(moveTile(tiles, tile.id, to))}
									onchange={(change) => saveTiles(updateTile(tiles, tile.id, change))}
								/>
							{/if}
							{@render tilesById(tile.id)}
						</div>
					{/each}
				</div>

				{#if editing && editor}
					<editor.EditBar
						{tiles}
						onshow={(id) => saveTiles(updateTile(tiles, id, { hidden: false }))}
						onreset={() => saveTiles(defaultTiles())}
						ondone={() => (editing = false)}
					/>
				{:else}
					<p class="mt-6 flex justify-center print:hidden">
						<button
							type="button"
							class="flex min-h-11 pill cursor-pointer items-center gap-2 px-5 text-sm font-semibold"
							onclick={startEditing}
						>
							<LayoutGrid size={16} aria-hidden="true" />
							{m.tiles_arrange()}
						</button>
					</p>
				{/if}
			</div>
		</div>
	{/if}

	<SiteFooter />
</main>

<SkyLayer kind={sky} falling={precipitation(skyAt.condition)} />
{#if sheetUsed}
	{#await import('#lib/components/PlaceSheet.svelte') then { default: PlaceSheet }}
		<PlaceSheet current={data.coordinates} />
	{/await}
{/if}

{#snippet umbrellaTile()}
	<section class="flex flex-col glass p-6">
		<UmbrellaTile hours={forecast.hours} {f} nowcast={forecast.nowcast} now={now.time} />
		{#if commute}
			<!-- The server knows there is a line, so its room is kept while its words load. -->
			<div class="mt-3 min-h-10">
				{#await import('#lib/components/CommuteLine.svelte') then { default: CommuteLine }}
					<CommuteLine check={commute} {f} />
				{/await}
			</div>
		{/if}
		<a
			href="{resolve('/p/[coords]/[[name]]', {
				coords: page.params.coords ?? '',
				name: encodeURIComponent(page.params.name ?? '')
			})}?radar"
			class="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-2 text-sm font-semibold underline-offset-4 hover:underline"
		>
			{m.radar_link()}
			<ChevronRight size={16} aria-hidden="true" />
		</a>
	</section>
{/snippet}

{#snippet activitiesTile()}
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
		>
			{m.better_link()}
			<ChevronRight size={16} aria-hidden="true" />
		</a>
	</section>
{/snippet}

{#snippet hoursTile()}
	<section class="glass p-5">
		<h2 class="question">{m.next_hours()}</h2>
		<HourlyStrip hours={forecast.hours.slice(0, 24)} {f} />
	</section>
{/snippet}

{#snippet chartTile()}
	<section class="glass p-6">
		<TempChart hours={forecast.hours.slice(0, 25)} {f} />
		<a
			href="{resolve('/p/[coords]/[[name]]', {
				coords: page.params.coords ?? '',
				name: encodeURIComponent(page.params.name ?? '')
			})}?models"
			class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
		>
			{m.compare_models()}
			<ChevronRight size={16} aria-hidden="true" />
		</a>
	</section>
{/snippet}

{#snippet tomorrowTile()}
	<TomorrowTile days={forecast.days} hours={forecast.hours} {f} />
{/snippet}

{#snippet daysTile()}
	<section class="glass p-6">
		<h2 class="question">{m.ten_days()}</h2>
		<DailyList days={forecast.days} hours={forecast.hours} {f} />
		<a
			href="{resolve('/p/[coords]/[[name]]', {
				coords: page.params.coords ?? '',
				name: encodeURIComponent(page.params.name ?? '')
			})}?week"
			class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
		>
			{m.week_link()}
			<ChevronRight size={16} aria-hidden="true" />
		</a>
		<CompareWith current={place} />
	</section>
{/snippet}

{#snippet detailsTile()}
	<section class="glass p-6">
		<h2 class="question">{m.today_details()}</h2>
		<DayFacts
			day={today}
			{f}
			humidity={now.humidity}
			snowDepth={now.snowDepth}
			pressure={now.pressure}
			ahead={forecast.hours}
		/>
	</section>
{/snippet}

{#snippet windTile()}
	<section class="glass p-6">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<p class="question"><Wind size={18} aria-hidden="true" /> {m.wind_question()}</p>
				<p class="mt-2 answer">{windAnswer}</p>
				<p class="mt-2 text-sm text-ink-muted">
					{direction} · {m.wind_detail({ speed: f.wind(now.wind), gust: f.wind(now.gust) })}
				</p>
			</div>
			<WindDial from={now.windDirection} />
		</div>
		{#if strongestGust >= STRONG_GUST_KMH}
			<p class="mt-3 flex items-start gap-1.5 text-sm font-semibold text-sun">
				<TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
				{m.wind_gust_warning({ gust: f.wind(strongestGust) })}
			</p>
		{/if}
		{#if sea}
			<p class="mt-3 flex items-start gap-1.5 text-sm text-ink-muted">
				<Waves size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
				<span>
					{sea}
					{#if forecast.sea?.temp != null}{m.sea_temp({ temp: f.temp(forecast.sea.temp) })}{/if}
				</span>
			</p>
		{/if}
	</section>
{/snippet}

{#snippet pastTile()}
	<WhenNear>
		{#await import('#lib/components/PastTiles.svelte') then { default: PastTiles }}
			<PastTiles coordinates={data.coordinates} {today} {f} />
		{/await}
	</WhenNear>
{/snippet}

{#snippet mapTile()}
	<!-- Leaflet is 43 kB: only once the tile is on screen, never on the first load. -->
	<WhenNear margin="0px">
		{#await import('#lib/components/MapTile.svelte') then { default: MapTile }}
			<MapTile
				coordinates={data.coordinates}
				place={name}
				utcOffsetSeconds={forecast.utcOffsetSeconds}
				{f}
			/>
		{/await}
	</WhenNear>
{/snippet}

{#snippet darkTile()}
	<WhenNear>
		{#await import('#lib/components/DarkTile.svelte') then { default: DarkTile }}
			<DarkTile {forecast} {f} />
		{/await}
	</WhenNear>
{/snippet}

{#snippet chartsTile()}
	<WhenNear>
		{#await import('#lib/components/ChartsTile.svelte') then { default: ChartsTile }}
			<ChartsTile hours={forecast.hours.slice(0, 25)} {f} />
		{/await}
	</WhenNear>
{/snippet}

{#snippet tilesById(id: TileId)}
	{#if id === 'umbrella'}{@render umbrellaTile()}
	{:else if id === 'activities'}{@render activitiesTile()}
	{:else if id === 'hours'}{@render hoursTile()}
	{:else if id === 'chart'}{@render chartTile()}
	{:else if id === 'tomorrow'}{@render tomorrowTile()}
	{:else if id === 'days'}{@render daysTile()}
	{:else if id === 'map'}{@render mapTile()}
	{:else if id === 'details'}{@render detailsTile()}
	{:else if id === 'charts'}{@render chartsTile()}
	{:else if id === 'wind'}{@render windTile()}
	{:else if id === 'dark'}{@render darkTile()}
	{:else}{@render pastTile()}
	{/if}
{/snippet}
