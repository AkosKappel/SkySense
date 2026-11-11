<script lang="ts">
	import { ArrowLeft, CloudRain, Pause, Play } from '@lucide/svelte';
	import type { Map as LeafletMap, Rectangle, TileLayer } from 'leaflet';
	import { onMount } from 'svelte';
	import { CARTO_BASEMAP_KEY } from '$app/env/public';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		firstWetHour,
		GRID_WET_MM,
		RADAR_MAX_ZOOM,
		type GridCell,
		type RadarFrames
	} from '#lib/radar.js';
	import type { Coordinates } from '#lib/weather.js';

	// The rain radar (M-01): RainViewer's last two hours, then the model's next hours from a grid of
	// forecasts. Leaflet loads only here, when the view opens, never with the forecast page.
	let {
		coordinates,
		place,
		utcOffsetSeconds,
		f
	}: { coordinates: Coordinates; place: string; utcOffsetSeconds: number; f: Formatter } = $props();

	let radar = $state<RadarFrames | null>(null);
	let grid = $state<GridCell[]>([]);
	let failed = $state(false);
	let index = $state(0);
	let playing = $state(false);
	let container = $state<HTMLDivElement>();

	/** A RainViewer time (UTC seconds) as the place's wall clock, like the forecast's times. */
	const placeTime = (seconds: number) =>
		new Date((seconds + utcOffsetSeconds) * 1000).toISOString().slice(0, 16);

	// One timeline: the radar frames, then the model's hours that come after the last of them.
	const steps = $derived.by(() => {
		const past = (radar?.frames ?? []).map((frame) => ({
			kind: 'radar' as const,
			time: placeTime(frame.time),
			path: frame.path
		}));
		const last = past.at(-1)?.time ?? '';
		const next = (grid[0]?.hours ?? [])
			.filter((h) => h.time > last)
			.map((h) => ({ kind: 'model' as const, time: h.time, path: '' }));
		return [...past, ...next];
	});
	const step = $derived(steps[index]);
	const wetFrom = $derived(firstWetHour(grid));
	const label = (s: (typeof steps)[number]) =>
		s.kind === 'radar'
			? m.radar_frame_radar({ time: f.time(s.time) })
			: m.radar_frame_model({ time: f.time(s.time) });

	let map: LeafletMap | undefined;
	let leaflet: typeof import('leaflet') | undefined;
	// One layer per radar frame, made when first shown; not state, the map draws them.
	const radarLayers: Record<string, TileLayer> = {};
	let cells: Rectangle[] = [];

	onMount(() => {
		let cancelled = false;
		(async () => {
			const query = `lat=${coordinates.lat}&lon=${coordinates.lon}`;
			const [frames, gridCells] = await Promise.all([
				fetch('/api/radar').then((r) => (r.ok ? (r.json() as Promise<RadarFrames>) : null)),
				fetch(`/api/rain-grid?${query}`).then((r) =>
					r.ok ? (r.json() as Promise<GridCell[]>) : []
				)
			]);
			if (cancelled) return;
			if (!frames) {
				failed = true;
				return;
			}
			radar = frames;
			grid = gridCells;
			index = Math.max(0, frames.frames.length - 1);

			const L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
			if (cancelled || !container) return;
			leaflet = L;
			map = L.map(container, {
				center: [coordinates.lat, coordinates.lon],
				zoom: RADAR_MAX_ZOOM,
				minZoom: 5,
				maxZoom: 9,
				attributionControl: true
			});
			map.attributionControl.setPrefix(false);
			if (CARTO_BASEMAP_KEY) {
				L.tileLayer(
					`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`,
					{
						attribution:
							'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
						subdomains: 'abcd'
					}
				).addTo(map);
			}
			map.attributionControl.addAttribution(
				'Radar <a href="https://www.rainviewer.com/">RainViewer</a> · Forecast <a href="https://open-meteo.com/">Open-Meteo</a>'
			);
			const token = (name: string) =>
				getComputedStyle(document.documentElement).getPropertyValue(name);
			L.circleMarker([coordinates.lat, coordinates.lon], {
				radius: 6,
				color: token('--color-ink'),
				weight: 2,
				fillOpacity: 1,
				fillColor: token('--color-sun'),
				interactive: false
			}).addTo(map);
			show();
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});

	/** Puts the current step on the map: its radar layer, or the model's grid for that hour. */
	function show() {
		const L = leaflet;
		if (!L || !map || !radar || !step) return;
		for (const [path, layer] of Object.entries(radarLayers)) {
			layer.setOpacity(path === step.path ? 0.75 : 0);
		}
		if (step.kind === 'radar' && !radarLayers[step.path]) {
			const layer = L.tileLayer(`${radar.host}${step.path}/256/{z}/{x}/{y}/2/1_1.png`, {
				maxNativeZoom: RADAR_MAX_ZOOM,
				opacity: 0.75
			}).addTo(map);
			radarLayers[step.path] = layer;
		}
		for (const cell of cells) cell.remove();
		cells = [];
		if (step.kind !== 'model') return;
		const rain = getComputedStyle(document.documentElement).getPropertyValue('--color-rain');
		const half = { lat: 0.15, lon: Math.abs((grid[1]?.lon ?? 0) - (grid[0]?.lon ?? 0)) / 2 };
		for (const cell of grid) {
			const mm = cell.hours.find((h) => h.time === step.time)?.rain ?? 0;
			if (mm < GRID_WET_MM) continue;
			cells.push(
				L.rectangle(
					[
						[cell.lat - half.lat, cell.lon - half.lon],
						[cell.lat + half.lat, cell.lon + half.lon]
					],
					{
						stroke: false,
						fillColor: rain,
						fillOpacity: Math.min(0.75, 0.2 + mm / 6),
						interactive: false
					}
				).addTo(map)
			);
		}
	}

	$effect(() => {
		void step;
		show();
	});

	// Playing is something the reader starts, so it runs under reduced motion too; it never starts
	// on its own.
	$effect(() => {
		if (!playing) return;
		const timer = setInterval(() => {
			index = (index + 1) % steps.length;
		}, 900);
		return () => clearInterval(timer);
	});
</script>

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
	<h1 class="text-2xl font-extrabold">{m.radar_title({ place })}</h1>
</div>

{#if failed}
	<p class="mt-4 glass p-6">{m.radar_unavailable()}</p>
{:else}
	<section class="mt-4 glass p-4 md:p-6">
		<p class="question px-2"><CloudRain size={18} aria-hidden="true" /> {m.radar_link()}</p>
		{#if radar}
			<p class="mt-2 px-2 answer">
				{wetFrom ? m.radar_model_wet({ time: f.time(wetFrom) }) : m.radar_model_dry()}
			</p>
			{#if radar.frames.length}
				<p class="mt-1 px-2 text-sm text-ink-muted">
					{m.radar_latest({ time: f.time(placeTime(radar.frames.at(-1)!.time)) })}
				</p>
			{/if}
		{/if}

		<div
			bind:this={container}
			role="region"
			aria-label={m.radar_map({ place })}
			class="mt-4 h-[60vh] max-h-[34rem] min-h-72 overflow-hidden rounded-2xl bg-map forced-color-adjust-none"
		></div>

		{#if steps.length}
			<div class="mt-4 flex items-center gap-3 px-2">
				<button
					type="button"
					class="grid size-11 shrink-0 pill cursor-pointer place-items-center"
					aria-label={playing ? m.radar_pause() : m.radar_play()}
					aria-pressed={playing}
					onclick={() => (playing = !playing)}
				>
					{#if playing}<Pause size={18} aria-hidden="true" />{:else}<Play
							size={18}
							aria-hidden="true"
						/>{/if}
				</button>
				<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
					<span class="sr-only">{m.radar_time()}</span>
					<input
						type="range"
						min="0"
						max={steps.length - 1}
						bind:value={index}
						aria-valuetext={step ? label(step) : ''}
						class="w-full accent-sun"
					/>
				</label>
				<span class="shrink-0 text-sm font-semibold tabular-nums" aria-hidden="true"
					>{step ? f.time(step.time) : ''}</span
				>
			</div>
			<ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-sm text-ink-muted">
				<li class="flex items-center gap-1.5">
					<span
						class="h-3 w-16 rounded-sm bg-(image:--radar-legend) forced-color-adjust-none"
						aria-hidden="true"
					></span>
					{m.radar_legend_radar()}
				</li>
				<li class="flex items-center gap-1.5">
					<span class="size-3 rounded-sm bg-rain/50 forced-color-adjust-none" aria-hidden="true"
					></span>
					{m.radar_legend_model()}
				</li>
			</ul>
		{/if}
	</section>
{/if}
