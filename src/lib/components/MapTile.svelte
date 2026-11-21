<script lang="ts">
	import { ChevronRight, MapIcon } from '@lucide/svelte';
	import type { Map as LeafletMap } from 'leaflet';
	import { CARTO_BASEMAP_KEY } from '$app/env/public';
	import { resolve } from '$app/paths';
	import { addBasemap } from '#lib/basemap.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { startZoom, RADAR_MAX_ZOOM, type RadarFrames } from '#lib/radar.js';
	import type { Coordinates } from '#lib/weather.js';

	// The place on a small map with the latest radar picture (M-12). It holds still, so it never
	// catches a scroll; a tap opens the map page. Loaded when scrolled near, so Leaflet stays out of
	// the place page's first scripts.
	let {
		coordinates,
		place,
		utcOffsetSeconds,
		f
	}: { coordinates: Coordinates; place: string; utcOffsetSeconds: number; f: Formatter } = $props();

	let container = $state<HTMLDivElement>();
	let radarAt = $state<string | null>(null);
	let failed = $state(false);

	const mapHref = $derived(
		resolve('/map/[coords]/[[name]]', {
			coords: `${coordinates.lat},${coordinates.lon}`,
			name: encodeURIComponent(place)
		})
	);

	$effect(() => {
		if (!container) return;
		let map: LeafletMap | undefined;
		let cancelled = false;
		void (async () => {
			const [L, radar] = await Promise.all([
				import('leaflet'),
				fetch('/api/radar')
					.then((r) => (r.ok ? (r.json() as Promise<RadarFrames>) : null))
					.catch(() => null),
				import('leaflet/dist/leaflet.css')
			]);
			if (cancelled || !container) return;
			map = L.map(container, {
				center: [coordinates.lat, coordinates.lon],
				zoom: startZoom(coordinates.lat) - 1,
				zoomSnap: 0.25,
				dragging: false,
				touchZoom: false,
				doubleClickZoom: false,
				scrollWheelZoom: false,
				boxZoom: false,
				keyboard: false,
				zoomControl: false,
				// The credits are links under the map, as the map itself is hidden from screen readers.
				attributionControl: false
			});
			addBasemap(L, map);
			const frame = radar?.frames.at(-1);
			if (frame) {
				L.tileLayer(`${radar!.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
					maxNativeZoom: RADAR_MAX_ZOOM,
					opacity: 0.75
				}).addTo(map);
				radarAt = new Date((frame.time + utcOffsetSeconds) * 1000).toISOString().slice(0, 16);
			} else {
				failed = true;
			}
			const token = (name: string) => getComputedStyle(container!).getPropertyValue(name);
			L.circleMarker([coordinates.lat, coordinates.lon], {
				radius: 6,
				color: token('--color-ink'),
				weight: 2,
				fillOpacity: 1,
				fillColor: token('--color-sun'),
				interactive: false
			}).addTo(map);
			// A full load, like the link below and the header's map button: the map page builds its
			// own map on mount.
			map.on('click', () => location.assign(mapHref));
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});
</script>

<section class="flex flex-col glass p-6">
	<p class="question"><MapIcon size={18} aria-hidden="true" /> {m.map_question()}</p>
	<p class="mt-2 text-sm text-ink-muted" aria-live="polite">
		{#if radarAt}{m.map_radar_at({ time: f.time(radarAt) })}{:else if failed}{m.map_no_radar()}{/if}
	</p>
	<!-- The picture repeats the radar in the link below, so it is hidden from screen readers. -->
	<div
		bind:this={container}
		aria-hidden="true"
		class="dark-scope mt-3 aspect-[4/3] cursor-pointer overflow-hidden rounded-2xl bg-map forced-color-adjust-none md:aspect-auto md:min-h-56 md:flex-1"
	></div>
	<p class="mt-1 text-xs text-ink-muted">
		{#if CARTO_BASEMAP_KEY}©
			<a href="https://www.openstreetmap.org/copyright" class="underline">OpenStreetMap</a>
			©
			<a href="https://carto.com/attributions" class="underline">CARTO</a> ·{/if}
		Radar <a href="https://www.rainviewer.com/" class="underline">RainViewer</a>
	</p>
	<a
		href={mapHref}
		data-sveltekit-reload
		class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
	>
		{m.map_open()}
		<ChevronRight size={16} aria-hidden="true" />
	</a>
</section>
