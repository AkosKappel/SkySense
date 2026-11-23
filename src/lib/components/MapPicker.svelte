<script lang="ts">
	import { Check, MapPin, X } from '@lucide/svelte';
	import type { Map as LeafletMap } from 'leaflet';
	import { addBasemap } from '#lib/basemap.js';
	import { m } from '#lib/paraglide/messages.js';
	import { areaName } from '#lib/open-live.js';
	import type { SavedPlace } from '#lib/places.svelte.js';
	import { formatCoordinates, roundCoordinates, type Coordinates } from '#lib/weather.js';

	// Choosing a place by pointing at it (M-13), for spots without a searchable name. The pin
	// stays in the middle and the map moves under it: a tap moves the map there, arrow keys pan it.
	// Nothing changes until the reader confirms, so a stray tap is harmless.
	let {
		near,
		onpick,
		oncancel
	}: { near?: Coordinates; onpick: (place: SavedPlace) => void; oncancel: () => void } = $props();

	let container = $state<HTMLDivElement>();
	let point = $state<Coordinates>();
	let name = $state<string>();
	let looking = $state(false);
	let lookup = 0;

	// Without a place to start from, most of Europe, where the app's languages are spoken.
	const start = $derived(near ?? { lat: 48, lon: 14 });

	async function nameAt(at: Coordinates) {
		const request = ++lookup;
		looking = true;
		const found = await areaName(at);
		if (request !== lookup) return;
		name = found;
		looking = false;
	}

	$effect(() => {
		if (!container) return;
		let map: LeafletMap | undefined;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		void (async () => {
			const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
			if (cancelled || !container) return;
			map = L.map(container, {
				center: [start.lat, start.lon],
				zoom: near ? 10 : 4,
				zoomSnap: 0.25,
				minZoom: 3,
				maxZoom: 14
			});
			addBasemap(L, map);
			map.on('click', (event) => map!.panTo(event.latlng));
			const settle = () => {
				const center = map!.getCenter().wrap();
				point = roundCoordinates({ lat: center.lat, lon: center.lng });
				name = undefined;
				clearTimeout(timer);
				// Panning with the keys moves in steps; name the spot once the map rests.
				timer = setTimeout(() => nameAt(point!), 400);
			};
			map.on('moveend', settle);
			map.on('keydown', ({ originalEvent: event }) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					confirm();
				} else if (event.key === 'Escape') {
					// Closes the map only, not a sheet around it.
					event.preventDefault();
					event.stopPropagation();
					oncancel();
				}
			});
			settle();
			container.focus();
		})();
		return () => {
			cancelled = true;
			clearTimeout(timer);
			map?.remove();
		};
	});

	function confirm() {
		if (!point) return;
		const coordinates = formatCoordinates(point);
		onpick(name ? { name, detail: coordinates, ...point } : { name: coordinates, ...point });
	}
</script>

<div class="mt-4">
	<p id="map-picker-help" class="text-sm text-ink-muted">{m.pick_on_map_help()}</p>
	<div class="dark-scope relative mt-2">
		<!-- Leaflet makes the map focusable: arrow keys pan, + and - zoom, Enter takes the spot. -->
		<div
			bind:this={container}
			role="application"
			aria-label={m.pick_on_map()}
			aria-describedby="map-picker-help"
			class="h-72 overflow-hidden rounded-2xl bg-map forced-color-adjust-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-veil"
		></div>
		<!-- Above Leaflet's panes (z-index 400), below its controls (1000). -->
		<MapPin
			size={36}
			strokeWidth={2.5}
			class="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-x-1/2 -translate-y-full fill-sun text-map drop-shadow"
			aria-hidden="true"
		/>
	</div>
	<p class="mt-2 min-h-6 font-semibold" aria-live="polite">
		{#if point}
			{#if name}{name}
				<span class="font-normal text-ink-muted">· {formatCoordinates(point)}</span>
			{:else}{formatCoordinates(point)}
				{#if looking}<span class="sr-only">…</span>{/if}
			{/if}
		{/if}
	</p>
	<div class="mt-2 flex flex-wrap gap-2">
		<button
			type="button"
			onclick={confirm}
			disabled={!point}
			class="flex h-12 cursor-pointer items-center gap-2 rounded-full bg-veil/20 px-5 font-semibold outline-1 outline-veil/30 transition hover:bg-veil/30"
		>
			<Check size={18} aria-hidden="true" />
			{m.pick_on_map_confirm()}
		</button>
		<button
			type="button"
			onclick={oncancel}
			class="flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 font-semibold underline-offset-4 hover:underline"
		>
			<X size={18} aria-hidden="true" />
			{m.cancel()}
		</button>
	</div>
</div>
