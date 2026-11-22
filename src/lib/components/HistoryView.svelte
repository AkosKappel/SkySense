<script lang="ts">
	import {
		ChevronLeft,
		ChevronRight,
		Droplets,
		Snowflake,
		Sun,
		Thermometer,
		TrendingUp,
		Wind
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Formatter } from '#lib/format.js';
	import {
		againstNormal,
		FIRST_DAY,
		formatPeriod,
		records as recordsOf,
		periodOf,
		scales,
		step,
		choosePeriod
	} from '#lib/history.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		era5Cell,
		HOT_DAY,
		lastWholeYear,
		REFERENCE,
		trendOf,
		type ClimateRecord
	} from '#lib/trend.js';
	import type { Coordinates } from '#lib/weather.js';
	import type { DailyHistory } from '#lib/year.js';

	let { coordinates, today, f }: { coordinates: Coordinates; today: string; f: Formatter } =
		$props();

	// Fetched in the browser, like the other tiles about the past: the place page's load and first
	// scripts stay as they were, and the browser's requests reach the CDN, which keeps the past for
	// a month or, for the long record, a year. Undefined while loading, null when it failed.
	const query = $derived(`lat=${coordinates.lat}&lon=${coordinates.lon}`);
	const chosen = $derived(choosePeriod(page.url.searchParams, today));
	let days = $state<DailyHistory | null>();
	let record = $state<ClimateRecord | null>();
	const load = <T,>(url: string, signal: AbortSignal) =>
		fetch(url, { signal }).then((r) => (r.ok ? (r.json() as Promise<T>) : null));
	$effect(() => {
		const controller = new AbortController();
		days = undefined;
		load<DailyHistory>(
			`/api/history?${query}&from=${chosen.from}&to=${chosen.until}`,
			controller.signal
		)
			.then((d) => (days = d))
			.catch(() => !controller.signal.aborted && (days = null));
		return () => controller.abort();
	});
	$effect(() => {
		const controller = new AbortController();
		const cell = era5Cell(coordinates);
		record = undefined;
		load<ClimateRecord>(
			`/api/record?lat=${cell.lat}&lon=${cell.lon}&until=${lastWholeYear(today)}`,
			controller.signal
		)
			.then((r) => (record = r))
			.catch(() => !controller.signal.aborted && (record = null));
		return () => controller.abort();
	});
	const history = $derived({
		...chosen,
		days,
		normals: record === undefined ? undefined : (record?.normals ?? null)
	});
	const trend = $derived(record ? trendOf(record, Number(chosen.at.slice(5, 7))) : null);
	const strongest = $derived(
		Math.max(0.1, ...(trend?.stripes.map((s) => Math.abs(s.anomaly)) ?? []))
	);
	const monthName = $derived(
		new Intl.DateTimeFormat(f.locale, { month: 'long', timeZone: 'UTC' }).format(
			new Date(`${chosen.at.slice(0, 7)}-01T00:00:00Z`)
		)
	);

	const scaleLabel = {
		day: m.history_day,
		week: m.history_week,
		month: m.history_month,
		year: m.history_year
	};
	const placeHref = () =>
		resolve('/p/[coords]/[[name]]', {
			coords: page.params.coords ?? '',
			name: encodeURIComponent(page.params.name ?? '')
		});

	const result = $derived(
		history.days && history.normals
			? againstNormal(history.days, history.normals, history.scale)
			: null
	);
	const records = $derived(history.days ? recordsOf(history.days) : null);
	const normal = $derived(history.normals?.find((n) => n.day === history.at.slice(5)));
	const earlier = $derived(step(history.scale, history.at, -1));
	const later = $derived(step(history.scale, history.at, 1));
	const lastDay = $derived(history.days?.at(-1)?.date);
	const widest = $derived(Math.max(1, ...(result?.buckets.map((b) => Math.abs(b.diff)) ?? [])));

	const cards = $derived.by(() => {
		if (!records) return [];
		if (history.scale === 'day') {
			const day = history.days![0];
			return [
				{
					icon: Sun,
					label: m.high(),
					value: f.temp(day.max),
					note: normal && m.history_usually({ value: f.temp(normal.max) })
				},
				{
					icon: Snowflake,
					label: m.low(),
					value: f.temp(day.min),
					note: normal && m.history_usually({ value: f.temp(normal.min) })
				},
				{ icon: Droplets, label: m.rain_amount(), value: f.rain(day.rain), note: undefined },
				{ icon: Wind, label: m.year_windiest(), value: f.wind(day.gust), note: undefined }
			];
		}
		return [
			{
				icon: Sun,
				label: m.year_warmest(),
				value: f.temp(records.warmest.value),
				note: f.pastDate(records.warmest.date)
			},
			{
				icon: Snowflake,
				label: m.year_coldest(),
				value: f.temp(records.coldest.value),
				note: f.pastDate(records.coldest.date)
			},
			{
				icon: Droplets,
				label: m.year_wettest(),
				value: f.rain(records.wettest.value),
				note: f.pastDate(records.wettest.date)
			},
			{
				icon: Wind,
				label: m.year_windiest(),
				value: f.wind(records.windiest.value),
				note: f.pastDate(records.windiest.date)
			}
		];
	});
</script>

<!-- Choosing the period: plain links and a GET form, so it works before the page's script runs. -->
<div class="mt-4 flex flex-wrap items-center gap-3 print:hidden">
	<nav aria-label={m.history_scale()} class="flex gap-1 glass p-1">
		{#each scales as scale (scale)}
			<a
				href="{resolve('/p/[coords]/[[name]]', {
					coords: page.params.coords ?? '',
					name: encodeURIComponent(page.params.name ?? '')
				})}?history={scale}&at={history.at}"
				aria-current={scale === history.scale ? 'page' : undefined}
				data-sveltekit-noscroll
				class="min-h-11 content-center rounded-full px-4 text-sm font-semibold aria-[current=page]:bg-veil/20"
			>
				{scaleLabel[scale]()}
			</a>
		{/each}
	</nav>
	<nav aria-label={m.history_steps()} class="flex gap-2">
		{#each [{ to: earlier, ok: periodOf(history.scale, earlier).to >= FIRST_DAY, Icon: ChevronLeft, label: m.history_earlier() }, { to: later, ok: later <= history.latest, Icon: ChevronRight, label: m.history_later() }] as { to, ok, Icon, label } (label)}
			{#if ok}
				<a
					href="{resolve('/p/[coords]/[[name]]', {
						coords: page.params.coords ?? '',
						name: encodeURIComponent(page.params.name ?? '')
					})}?history={history.scale}&at={to}"
					aria-label={label}
					title={label}
					data-sveltekit-noscroll
					class="grid size-11 pill place-items-center"
				>
					<Icon size={18} aria-hidden="true" />
				</a>
			{:else}
				<span class="grid size-11 pill place-items-center opacity-40" aria-hidden="true">
					<Icon size={18} />
				</span>
			{/if}
		{/each}
	</nav>
	<form method="GET" action={placeHref()} data-sveltekit-noscroll class="flex items-center gap-2">
		<input type="hidden" name="history" value={history.scale} />
		<label class="sr-only" for="history-at">{m.history_date()}</label>
		<input
			id="history-at"
			type="date"
			name="at"
			value={history.at}
			min={FIRST_DAY}
			max={history.latest}
			required
			class="min-h-11 rounded-full bg-veil/10 px-4 text-sm"
		/>
		<button class="min-h-11 pill px-4 text-sm font-semibold">{m.history_show()}</button>
	</form>
</div>

<section class="mt-4 glass p-6" aria-labelledby="history-period">
	<h2 id="history-period" class="question">
		<Thermometer size={18} aria-hidden="true" />
		{formatPeriod(history.scale, history.from, history.to, f.locale)}
	</h2>
	{#if history.days === undefined || history.normals === undefined}
		<!-- Loading: the heading and the controls are already there. -->
	{:else if !history.days || !history.normals}
		<p class="mt-2 text-lg font-semibold">{m.history_unavailable()}</p>
	{:else if !result}
		<p class="mt-2 text-lg font-semibold">{m.history_none()}</p>
	{:else}
		<p class="mt-2 answer">
			{result.warmth === 'warmer'
				? m.history_warmer({ diff: f.tempDelta(result.diff, 1) })
				: result.warmth === 'colder'
					? m.history_colder({ diff: f.tempDelta(-result.diff, 1) })
					: m.history_about()}
		</p>
		<!-- A day's usual rain is an average of mostly dry days, so one day is not compared with it. -->
		{#if history.scale !== 'day'}
			<p class="mt-2 text-lg font-semibold">
				{result.wetness === 'wetter'
					? m.history_wetter({ rain: f.rain(result.rain), normal: f.rain(result.normalRain) })
					: result.wetness === 'drier'
						? m.history_drier({ rain: f.rain(result.rain), normal: f.rain(result.normalRain) })
						: m.history_rain_usual({ rain: f.rain(result.rain) })}
			</p>
		{/if}
		{#if lastDay && lastDay < history.to}
			<p class="mt-2 text-sm text-ink-muted">{m.history_until({ date: f.pastDate(lastDay) })}</p>
		{/if}
		<p class="mt-2 text-sm text-ink-muted">{m.history_normal_note()}</p>
	{/if}
</section>

{#if result}
	<dl class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each cards as card (card.label)}
			{@const Icon = card.icon}
			<div class="glass p-5">
				<dt class="flex items-center gap-1.5 text-sm text-ink-muted">
					<Icon size={16} aria-hidden="true" />
					{card.label}
				</dt>
				<dd class="mt-1">
					<span class="block text-3xl font-bold tabular-nums">{card.value}</span>
					{#if card.note}<span class="text-sm text-ink-muted">{card.note}</span>{/if}
				</dd>
			</div>
		{/each}
	</dl>

	{#if result.buckets.length > 1}
		<section class="mt-4 glass p-6" aria-labelledby="history-chart">
			<h2 id="history-chart" class="question">{m.history_chart_question()}</h2>
			<!-- Above the middle line warmer than usual, below it colder; the table says the same in numbers. -->
			<div class="mt-4 flex h-32 items-stretch gap-px" aria-hidden="true">
				{#each result.buckets as bucket (bucket.key)}
					<div class="flex flex-1 flex-col">
						<div class="flex flex-1 items-end border-b border-veil/30">
							{#if bucket.diff > 0}
								<div
									class="w-full rounded-t-sm bg-warm forced-color-adjust-none forced-colors:bg-[CanvasText]"
									style:height="{(bucket.diff / widest) * 100}%"
								></div>
							{/if}
						</div>
						<div class="flex flex-1 items-start">
							{#if bucket.diff < 0}
								<div
									class="w-full rounded-b-sm bg-cold forced-color-adjust-none forced-colors:bg-[CanvasText]"
									style:height="{(-bucket.diff / widest) * 100}%"
								></div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			<div class="mt-1 flex justify-between text-[11px] text-ink-muted" aria-hidden="true">
				<span>
					{history.scale === 'year'
						? f.month(result.buckets[0].key)
						: f.pastDate(result.buckets[0].key)}
				</span>
				<span>
					{history.scale === 'year'
						? f.month(result.buckets.at(-1)!.key)
						: f.pastDate(result.buckets.at(-1)!.key)}
				</span>
			</div>
			<p class="mt-2 text-sm text-ink-muted">{m.history_chart_note()}</p>
			<details class="mt-3">
				<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold">
					{m.show_table()}
				</summary>
				<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
					<thead class="text-left text-ink-muted">
						<tr>
							<th scope="col" class="py-1 font-medium">
								{history.scale === 'year' ? m.history_month() : m.history_day()}
							</th>
							<th scope="col" class="py-1 font-medium">{m.high()}</th>
							<th scope="col" class="py-1 font-medium">{m.low()}</th>
							<th scope="col" class="py-1 font-medium">{m.rain_amount()}</th>
							<th scope="col" class="py-1 font-medium">{m.history_against_usual()}</th>
						</tr>
					</thead>
					<tbody>
						{#each result.buckets as bucket (bucket.key)}
							<tr class="border-t border-veil/10">
								<th scope="row" class="py-1 text-left font-medium">
									{history.scale === 'year' ? f.month(bucket.key, true) : f.pastDate(bucket.key)}
								</th>
								<td>{f.temp(bucket.max)}</td>
								<td>{f.temp(bucket.min)}</td>
								<td>{f.rain(bucket.rain)}</td>
								<td>
									{bucket.diff > 0 ? '+' : bucket.diff < 0 ? '−' : ''}{f.tempDelta(
										Math.abs(bucket.diff),
										1
									)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</details>
		</section>
	{/if}
{/if}

{#if trend}
	<section class="mt-4 glass p-6" aria-labelledby="history-trend">
		<h2 id="history-trend" class="question">
			<TrendingUp size={18} aria-hidden="true" />
			{m.trend_question()}
		</h2>
		<p class="mt-2 answer">
			{trend.warming >= 0.5
				? m.trend_warmer({ diff: f.tempDelta(trend.warming, 1) })
				: trend.warming <= -0.5
					? m.trend_colder({ diff: f.tempDelta(-trend.warming, 1) })
					: m.trend_same()}
		</p>
		{#if trend.monthPerDecade !== null}
			<p class="mt-2 text-lg font-semibold">
				{trend.monthPerDecade >= 0.1
					? m.trend_month_warmer({
							month: monthName,
							diff: f.tempDelta(trend.monthPerDecade, 1),
							from: trend.firstYear
						})
					: trend.monthPerDecade <= -0.1
						? m.trend_month_colder({
								month: monthName,
								diff: f.tempDelta(-trend.monthPerDecade, 1),
								from: trend.firstYear
							})
						: m.trend_month_same({ month: monthName, from: trend.firstYear })}
			</p>
		{/if}

		<!-- Warming stripes: one per year, the warm colour above the reference, the cool one below,
		     stronger the further from it. The table of years says the same in numbers. -->
		<div class="mt-4 flex h-16 overflow-hidden rounded-md" aria-hidden="true">
			{#each trend.stripes as stripe (stripe.year)}
				<div
					class="flex-1 forced-color-adjust-none {stripe.anomaly >= 0 ? 'bg-warm' : 'bg-cold'}"
					style:opacity={Math.max(0.08, Math.abs(stripe.anomaly) / strongest)}
				></div>
			{/each}
		</div>
		<div class="mt-1 flex justify-between text-[11px] text-ink-muted" aria-hidden="true">
			<span>{trend.firstYear}</span>
			<span>{trend.lastYear}</span>
		</div>
		<p class="mt-2 text-sm text-ink-muted">
			{m.trend_stripes_note({ from: REFERENCE[0], until: REFERENCE[1] })}
		</p>

		<table class="mt-4 w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
			<caption class="pb-1 text-left text-sm text-ink-muted">{m.trend_decades_caption()}</caption>
			<thead class="text-left text-ink-muted">
				<tr>
					<th scope="col" class="py-1 font-medium">{m.trend_decade()}</th>
					<th scope="col" class="py-1 font-medium">{m.trend_hot({ temp: f.temp(HOT_DAY) })}</th>
					<th scope="col" class="py-1 font-medium">{m.trend_frost({ temp: f.temp(0) })}</th>
					<th scope="col" class="py-1 font-medium">{m.year_rain_days()}</th>
				</tr>
			</thead>
			<tbody>
				{#each trend.decades as decade (decade.decade)}
					<tr class="border-t border-veil/10">
						<th scope="row" class="py-1 text-left font-medium">
							{m.trend_decade_label({ decade: decade.decade, end: decade.to })}
						</th>
						<td>{decade.hot}</td>
						<td>{decade.frost}</td>
						<td>{decade.rainDays}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<details class="mt-3">
			<summary class="min-h-11 cursor-pointer content-center text-sm font-semibold">
				{m.trend_years_table()}
			</summary>
			<table class="w-full text-sm tabular-nums [&_td]:pr-3 [&_th]:pr-3">
				<thead class="text-left text-ink-muted">
					<tr>
						<th scope="col" class="py-1 font-medium">{m.history_year()}</th>
						<th scope="col" class="py-1 font-medium">
							{m.trend_against_reference({ from: REFERENCE[0], until: REFERENCE[1] })}
						</th>
					</tr>
				</thead>
				<tbody>
					{#each trend.stripes.toReversed() as stripe (stripe.year)}
						<tr class="border-t border-veil/10">
							<th scope="row" class="py-1 text-left font-medium">{stripe.year}</th>
							<td>
								{stripe.anomaly > 0 ? '+' : stripe.anomaly < 0 ? '−' : ''}{f.tempDelta(
									Math.abs(stripe.anomaly),
									1
								)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</details>
	</section>
{/if}
