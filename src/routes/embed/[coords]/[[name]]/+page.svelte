<script lang="ts">
	import { Umbrella } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { summarize } from '#lib/summary.js';
	import { formatCoordinates, nextRain } from '#lib/weather.js';
	import type { PageProps } from './$types';

	// A small card for other sites' iframes (X-12): now, the summary and the umbrella answer, with
	// a link to the full forecast. `<iframe src="/embed/48.15,17.11/Bratislava" height="260">`.
	let { data }: PageProps = $props();

	const f = $derived(formatter(getLocale(), data.units));
	const forecast = $derived(data.forecast);
	const now = $derived(forecast.current);
	const name = $derived(data.name ?? m.unnamed_place());
	const rain = $derived(nextRain(forecast.hours, 24));
</script>

<svelte:head>
	<title>{m.weather_in({ place: name })} · SkySense</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="p-3">
	<article class="glass p-5">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h1 class="truncate text-sm font-semibold text-ink-muted">{name}</h1>
				<p class="text-5xl font-bold tracking-tight tabular-nums">{f.temp(now.temp)}</p>
				<p class="mt-1">{conditionLabel(now.condition, now.isDay)}</p>
			</div>
			<WeatherIcon condition={now.condition} isDay={now.isDay} size={56} strokeWidth={1.25} />
		</div>
		<div class="mt-3 text-base [&_p]:text-base">
			<SummaryLine sentences={summarize(forecast.hours, now.temp)} {f} />
		</div>
		<p class="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
			<Umbrella size={14} aria-hidden="true" />
			{rain ? m.embed_umbrella_yes() : m.embed_umbrella_no()}
		</p>
		<p class="mt-3 flex flex-wrap justify-between gap-x-3 text-xs text-ink-muted">
			<a
				href={resolve('/p/[coords]/[[name]]', {
					coords: formatCoordinates(data.coordinates),
					name: encodeURIComponent(name)
				})}
				target="_blank"
				rel="noopener"
				class="font-semibold text-ink underline underline-offset-4">{m.embed_open()}</a
			>
			<a href="https://open-meteo.com/" target="_blank" rel="noopener" class="underline"
				>{m.data_attribution()}</a
			>
		</p>
	</article>
</main>
