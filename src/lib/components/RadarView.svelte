<script lang="ts">
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		CloudRain,
		Maximize,
		Minimize,
		Pause,
		Play
	} from '@lucide/svelte';
	import type { Layer, Map as LeafletMap, TileLayer } from 'leaflet';
	import { onMount } from 'svelte';
	import { CARTO_BASEMAP_KEY } from '$app/env/public';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Formatter } from '#lib/format.js';
	import { pageName, savedPlaces } from '#lib/places.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import {
		firstWetHour,
		GRID_WET_MM,
		FREEZING_C,
		RADAR_MAX_ZOOM,
		startZoom,
		temperatureBand,
		WARM_C,
		warmerSide,
		windAround,
		type GridCell,
		type GridLayer,
		type RadarFrames
	} from '#lib/radar.js';
	import { formatCoordinates, type Coordinates } from '#lib/weather.js';

	// The rain radar (M-01): RainViewer's last two hours, then the model's next hours from a grid of
	// forecasts, which also gives the temperature and wind layers (M-05). Leaflet loads only here,
	// when the view opens, never with the forecast page.
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
	let layer = $state<GridLayer>('rain');
	let container = $state<HTMLDivElement>();
	let section = $state<HTMLElement>();
	let fullscreen = $state(false);
	// iPhone Safari has no element full screen, so the button only shows where it works.
	let canFullscreen = $state(false);

	/** A RainViewer time (UTC seconds) as the place's wall clock, like the forecast's times. */
	const placeTime = (seconds: number) =>
		new Date((seconds + utcOffsetSeconds) * 1000).toISOString().slice(0, 16);

	// One timeline: the radar frames, then the model's hours that come after the last of them.
	// Temperature and wind come from the model only, so their timeline is its hours.
	const steps = $derived.by(() => {
		if (layer !== 'rain') {
			return (grid[0]?.hours ?? []).map((h) => ({
				kind: 'model' as const,
				time: h.time,
				path: ''
			}));
		}
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
	// The layer's answer in words, the text equivalent of what the map shows.
	const answer = $derived.by(() => {
		if (layer === 'rain') {
			return wetFrom ? m.radar_model_wet({ time: f.time(wetFrom) }) : m.radar_model_dry();
		}
		if (!step) return '';
		if (layer === 'temperature') {
			const warmer = warmerSide(grid, step.time);
			if (!warmer) return m.radar_temperature_even();
			const difference = f.tempDelta(warmer.by);
			return {
				n: m.radar_warmer_n,
				e: m.radar_warmer_e,
				s: m.radar_warmer_s,
				w: m.radar_warmer_w
			}[warmer.side]({ difference });
		}
		const wind = windAround(grid, step.time);
		if (!wind) return m.radar_wind_calm();
		return {
			n: m.radar_wind_n,
			ne: m.radar_wind_ne,
			e: m.radar_wind_e,
			se: m.radar_wind_se,
			s: m.radar_wind_s,
			sw: m.radar_wind_sw,
			w: m.radar_wind_w,
			nw: m.radar_wind_nw
		}[wind.from]({ speed: f.wind(wind.max) });
	});
	const label = (s: (typeof steps)[number]) =>
		s.kind === 'radar'
			? m.radar_frame_radar({ time: f.time(s.time) })
			: m.radar_frame_model({ time: f.time(s.time) });

	let map: LeafletMap | undefined;
	let leaflet: typeof import('leaflet') | undefined;
	// One layer per radar frame, made when first shown; not state, the map draws them.
	const radarLayers: Record<string, TileLayer> = {};
	// What the model's layer draws for the current hour: rain cells, or temperature and wind labels.
	let cells: Layer[] = [];

	onMount(() => {
		let cancelled = false;
		canFullscreen = document.fullscreenEnabled;
		// Esc leaves full screen without our button, so the state follows the document.
		const onFullscreenChange = () => {
			fullscreen = document.fullscreenElement === section;
			map?.invalidateSize();
		};
		document.addEventListener('fullscreenchange', onFullscreenChange);
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
				zoom: startZoom(coordinates.lat),
				// Quarter steps, so the starting zoom near the equator can sit between whole levels.
				zoomSnap: 0.25,
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
			const token = (name: string) => getComputedStyle(container!).getPropertyValue(name);
			L.circleMarker([coordinates.lat, coordinates.lon], {
				radius: 6,
				color: token('--color-ink'),
				weight: 2,
				fillOpacity: 1,
				fillColor: token('--color-sun'),
				interactive: false
			}).addTo(map);
			addSavedPlaces(L, map);
			show();
		})();
		return () => {
			cancelled = true;
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			map?.remove();
		};
	});

	/**
	 * The other saved places (M-03), each a link to its own radar. Real links rather than Leaflet's
	 * keyboard markers, so they are tabbable, open with Enter and are announced by name.
	 */
	function addSavedPlaces(L: typeof import('leaflet'), map: LeafletMap) {
		for (const saved of savedPlaces.list) {
			if (formatCoordinates(saved) === formatCoordinates(coordinates)) continue;
			const name = pageName(saved);
			const link = document.createElement('a');
			link.href = `${resolve('/p/[coords]/[[name]]', {
				coords: formatCoordinates(saved),
				name: encodeURIComponent(name)
			})}?radar`;
			link.className =
				'pointer-events-auto flex items-center gap-1.5 rounded-sm whitespace-nowrap text-sm font-semibold text-ink! [text-shadow:0_1px_3px_black] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun';
			link.setAttribute('aria-label', m.radar_title({ place: name }));
			const dot = document.createElement('span');
			dot.className = 'size-3 shrink-0 rounded-full border-2 border-ink bg-rain';
			link.append(dot, name);
			// Tabbing to a place off the map would scroll the map's box; bring the place into view instead.
			link.addEventListener('focus', () => {
				container?.scrollTo(0, 0);
				map.panTo([saved.lat, saved.lon]);
			});
			L.marker([saved.lat, saved.lon], {
				icon: L.divIcon({ html: link, className: '', iconSize: undefined, iconAnchor: [6, 6] }),
				interactive: false,
				keyboard: false
			}).addTo(map);
		}
	}

	/** Puts the current step on the map: its radar layer, or the model's grid for that hour. */
	function show() {
		const L = leaflet;
		if (!L || !map || !radar || !step) return;
		const layerFor = (path: string) =>
			(radarLayers[path] ??= L.tileLayer(`${radar!.host}${path}/256/{z}/{x}/{y}/2/1_1.png`, {
				maxNativeZoom: RADAR_MAX_ZOOM,
				opacity: 0
			}).addTo(map!));
		if (step.kind === 'radar') layerFor(step.path);
		for (const [path, layer] of Object.entries(radarLayers)) {
			layer.setOpacity(path === step.path ? 0.75 : 0);
		}
		// The next frame loads hidden while this one shows, so playing does not flash an empty map.
		const next = steps[index + 1];
		if (next?.kind === 'radar') layerFor(next.path);
		for (const cell of cells) cell.remove();
		cells = [];
		if (step.kind !== 'model') return;
		if (layer !== 'rain') {
			drawLabels(L, map, step.time);
			return;
		}
		const rain = getComputedStyle(container!).getPropertyValue('--color-rain');
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

	/** The model's temperature, or its wind as an arrow and a speed, at each point of the grid. */
	function drawLabels(L: typeof import('leaflet'), map: LeafletMap, time: string) {
		// The point nearest the place gets its label above the place's dot instead of on it.
		const distance = (c: GridCell) => Math.hypot(c.lat - coordinates.lat, c.lon - coordinates.lon);
		const nearest = grid.reduce<GridCell | undefined>(
			(best, c) => (!best || distance(c) < distance(best) ? c : best),
			undefined
		);
		for (const cell of grid) {
			const hour = cell.hours.find((h) => h.time === time);
			if (!hour || Number.isNaN(hour.temperature)) continue;
			const tag = document.createElement('span');
			tag.className =
				'flex items-center justify-center gap-0.5 whitespace-nowrap text-xs font-bold text-ink [text-shadow:0_1px_3px_black]';
			if (layer === 'temperature') {
				tag.textContent = f.temp(hour.temperature);
				tag.classList.remove('text-ink');
				tag.classList.add(
					{ cold: 'text-cold', mild: 'text-ink', warm: 'text-warm' }[
						temperatureBand(hour.temperature)
					]
				);
			} else {
				// The arrow points where the wind goes: down for a north wind, turned by its direction.
				const arrow = document.createElement('span');
				arrow.className = 'inline-block text-sm';
				arrow.textContent = '↓';
				arrow.style.transform = `rotate(${hour.windFrom}deg)`;
				tag.append(arrow, String(f.windValue(hour.wind)));
			}
			cells.push(
				L.marker([cell.lat, cell.lon], {
					icon: L.divIcon({
						html: tag,
						className: '',
						iconSize: [44, 18],
						iconAnchor: [22, cell === nearest ? 22 : 9]
					}),
					interactive: false,
					keyboard: false
				}).addTo(map)
			);
		}
	}

	$effect(() => {
		void step;
		void layer;
		show();
	});

	function chooseLayer(next: GridLayer) {
		playing = false;
		layer = next;
		index = next === 'rain' ? Math.max(0, (radar?.frames.length ?? 0) - 1) : 0;
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void section?.requestFullscreen();
	}

	/** Steps one frame back or forward and stops playing, for reading the map frame by frame. */
	function stepBy(delta: number) {
		playing = false;
		index = Math.min(steps.length - 1, Math.max(0, index + delta));
	}

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
	<section
		bind:this={section}
		class="group mt-4 glass p-4 md:p-6 fullscreen:flex fullscreen:flex-col fullscreen:overflow-auto fullscreen:rounded-none fullscreen:bg-(image:--sky-dusk)"
	>
		<p class="question px-2"><CloudRain size={18} aria-hidden="true" /> {m.radar_link()}</p>
		{#if radar}
			<p class="mt-2 px-2 answer">{answer}</p>
			{#if layer === 'rain' && radar.frames.length}
				<p class="mt-1 px-2 text-sm text-ink-muted">
					{m.radar_latest({ time: f.time(placeTime(radar.frames.at(-1)!.time)) })}
				</p>
			{/if}
		{/if}

		<div
			bind:this={container}
			role="region"
			aria-label={{
				rain: m.radar_map,
				temperature: m.radar_map_temperature,
				wind: m.radar_map_wind
			}[layer]({ place })}
			class="dark-scope mt-4 h-[60vh] max-h-[34rem] min-h-72 overflow-hidden rounded-2xl bg-map forced-color-adjust-none group-fullscreen:h-auto group-fullscreen:max-h-none group-fullscreen:flex-1"
		></div>

		{#if grid.length}
			<fieldset class="mt-4 px-2">
				<legend class="sr-only">{m.radar_layer()}</legend>
				<div class="flex flex-wrap gap-2">
					{#each [['rain', m.radar_layer_rain], ['temperature', m.radar_layer_temperature], ['wind', m.radar_layer_wind]] as const as [value, text] (value)}
						<label
							class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 transition has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
						>
							<input
								type="radio"
								name="radar-layer"
								{value}
								checked={layer === value}
								onchange={() => chooseLayer(value)}
								class="sr-only"
							/>
							{text()}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if steps.length}
			<div class="mt-4 flex flex-wrap items-center gap-3 px-2">
				<div class="flex gap-2">
					<button
						type="button"
						class="grid size-11 shrink-0 pill cursor-pointer place-items-center disabled:opacity-50"
						aria-label={m.radar_previous()}
						disabled={index === 0}
						onclick={() => stepBy(-1)}
					>
						<ChevronLeft size={18} aria-hidden="true" />
					</button>
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
					<button
						type="button"
						class="grid size-11 shrink-0 pill cursor-pointer place-items-center disabled:opacity-50"
						aria-label={m.radar_next()}
						disabled={index === steps.length - 1}
						onclick={() => stepBy(1)}
					>
						<ChevronRight size={18} aria-hidden="true" />
					</button>
					{#if canFullscreen}
						<button
							type="button"
							class="grid size-11 shrink-0 pill cursor-pointer place-items-center"
							aria-label={fullscreen ? m.radar_fullscreen_leave() : m.radar_fullscreen()}
							onclick={toggleFullscreen}
						>
							{#if fullscreen}<Minimize size={18} aria-hidden="true" />{:else}<Maximize
									size={18}
									aria-hidden="true"
								/>{/if}
						</button>
					{/if}
				</div>
				<div class="flex min-w-48 flex-1 items-center gap-3">
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
			</div>
			{#if layer === 'temperature'}
				<p class="mt-3 px-2 text-sm text-ink-muted">
					{m.radar_legend_temperature({ cold: f.temp(FREEZING_C), hot: f.temp(WARM_C) })}
				</p>
			{:else if layer === 'wind'}
				<p class="mt-3 px-2 text-sm text-ink-muted">{m.radar_legend_wind()}</p>
			{:else}
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
		{/if}
	</section>
{/if}
