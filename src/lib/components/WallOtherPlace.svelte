<script lang="ts">
	import { Umbrella } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { placeNow, upcoming, type OtherPlace } from '#lib/wall.js';
	import { formatCoordinates, nextRain, type Forecast } from '#lib/weather.js';

	// A second place on the wall (F-32): home and where family lives, side by side. It fetches its
	// own forecast and refreshes with the wall; a failed refresh keeps the last one.
	let { place, f, clock }: { place: OtherPlace; f: Formatter; clock: number } = $props();

	const REFRESH_MS = 10 * 60 * 1000;
	let forecast = $state<Forecast | null>(null);

	$effect(() => {
		const { lat, lon } = place.coordinates;
		const load = () =>
			fetch(`/api/forecast?lat=${lat}&lon=${lon}`)
				.then((r) => (r.ok ? (r.json() as Promise<Forecast>) : null))
				.then((answer) => answer && (forecast = answer))
				.catch(() => null);
		load();
		const timer = setInterval(load, REFRESH_MS);
		return () => clearInterval(timer);
	});

	const name = $derived(place.name || m.unnamed_place());
	const local = $derived(forecast ? placeNow(forecast.utcOffsetSeconds, clock) : '');
	const hours = $derived(forecast ? upcoming(forecast.hours, local) : []);
	const now = $derived(hours[0] ?? forecast?.current);
	const today = $derived(forecast?.days.find((d) => local.startsWith(d.date)));
</script>

<section class="flex items-center gap-4 glass px-5 py-4" aria-label={name}>
	{#if forecast && now && today}
		<WeatherIcon condition={now.condition} isDay={now.isDay} size={56} />
		<div class="min-w-0 flex-1">
			<p class="flex flex-wrap items-baseline justify-between gap-x-3">
				<a
					href={resolve('/p/[coords]/[[name]]', {
						coords: formatCoordinates(place.coordinates),
						name: encodeURIComponent(name)
					})}
					class="truncate text-lg font-semibold underline-offset-4 hover:underline"
				>
					{name}
				</a>
				<span class="text-sm text-ink-muted tabular-nums">{f.time(local)}</span>
			</p>
			<p class="mt-1 text-sm text-ink-muted">
				<span class="text-3xl font-bold text-ink tabular-nums">{f.temp(now.temp)}</span>
				{conditionLabel(now.condition, now.isDay)} · {m.high_low({
					max: f.temp(today.max),
					min: f.temp(today.min)
				})}
			</p>
			<p class="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
				<Umbrella size={14} aria-hidden="true" />
				{nextRain(hours, 24) ? m.embed_umbrella_yes() : m.embed_umbrella_no()}
			</p>
		</div>
	{:else}
		<p class="text-lg font-semibold">{name}</p>
	{/if}
</section>
