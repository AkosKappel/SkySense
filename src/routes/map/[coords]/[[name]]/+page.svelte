<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PlaceSearch from '#lib/components/PlaceSearch.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatCoordinates } from '#lib/weather.js';
	import type { PageProps } from './$types';

	// The map as its own page (M-11): the radar with its temperature and wind layers, or where the
	// weather is better for an activity, around one place, with a search that stays on the map.
	// Both views load Leaflet on demand, like the place page's.
	let { data }: PageProps = $props();

	const f = $derived(formatter(getLocale(), data.units));
	const forecast = $derived(data.forecast);
	const name = $derived(data.name ?? m.unnamed_place());
	const better = $derived(page.url.searchParams.has('better'));
	const params = $derived({
		coords: formatCoordinates(data.coordinates),
		name: encodeURIComponent(name)
	});
	const chip = (on: boolean) =>
		`flex min-h-11 items-center rounded-full px-4 font-semibold outline-1 outline-veil/20 ${
			on ? 'bg-veil text-on-veil' : 'bg-veil/10 hover:bg-veil/20'
		}`;
</script>

<svelte:head>
	<title>{m.map_title({ place: name })} · SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[88rem] flex-col px-4 pt-5 md:px-8">
	<div class="flex items-center gap-3">
		<a
			href={resolve('/p/[coords]/[[name]]', params)}
			aria-label={m.back_to_forecast()}
			class="grid size-11 shrink-0 pill place-items-center"
		>
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{m.map_title({ place: name })}</h1>
	</div>

	<div class="mt-4 grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
		<nav aria-label={m.map_modes()}>
			<ul class="flex flex-wrap gap-2">
				<li>
					<a
						href={resolve('/map/[coords]/[[name]]', params)}
						aria-current={better ? undefined : 'page'}
						class={chip(!better)}>{m.map_mode_weather()}</a
					>
				</li>
				<li>
					<a
						href="{resolve('/map/[coords]/[[name]]', params)}?better"
						aria-current={better ? 'page' : undefined}
						class={chip(better)}>{m.better_link()}</a
					>
				</li>
			</ul>
		</nav>
		<PlaceSearch to="map" compact />
	</div>

	<!-- Each place and mode gets a fresh map: both views build theirs once, on mount. -->
	{#key `${params.coords}:${better}`}
		{#if better}
			{#await import('#lib/components/BetterView.svelte') then { default: BetterView }}
				<BetterView
					coordinates={data.coordinates}
					place={name}
					days={forecast.days.slice(0, 7)}
					now={forecast.current.time}
					{f}
					comfort={data.comfort}
					onMap
				/>
			{/await}
		{:else}
			{#await import('#lib/components/RadarView.svelte') then { default: RadarView }}
				<RadarView
					coordinates={data.coordinates}
					place={name}
					utcOffsetSeconds={forecast.utcOffsetSeconds}
					{f}
					onMap
				/>
			{/await}
		{/if}
	{/key}

	<SiteFooter />
</main>
