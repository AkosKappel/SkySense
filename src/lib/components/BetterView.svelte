<script lang="ts">
	import { MapPinned } from '@lucide/svelte';
	import type { Map as LeafletMap, Rectangle } from 'leaflet';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		activities,
		activityIds,
		comfortShift,
		type ActivityId,
		type Comfort
	} from '#lib/activities.js';
	import { activityChoice } from '#lib/activity-choice.svelte.js';
	import { addBasemap } from '#lib/basemap.js';
	import {
		betterAnswer,
		distanceAndDirection,
		AREA_SIDE,
		areaPoints,
		areaSquares,
		scoreArea,
		type AreaCell,
		type AreaScore
	} from '#lib/better.js';
	import { activityLabel } from '#lib/components/labels.js';
	import type { Formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatCoordinates, type Coordinates, type Day } from '#lib/weather.js';

	// "Where is the weather better?" (M-10): for an activity and a day, every point of a 7 × 7 grid
	// around the place coloured by the activity score the app already computes, the best point
	// named in a sentence above the map. Leaflet loads only here, like the radar.
	let {
		coordinates,
		place,
		days,
		now,
		f,
		comfort
	}: {
		coordinates: Coordinates;
		place: string;
		/** The days to choose from, today first. */
		days: Day[];
		/** The place's current time, so today only counts the hours still ahead. */
		now: string;
		f: Formatter;
		comfort: Comfort;
	} = $props();

	const SIDE = AREA_SIDE;
	const directions = {
		n: m.direction_n,
		ne: m.direction_ne,
		e: m.direction_e,
		se: m.direction_se,
		s: m.direction_s,
		sw: m.direction_sw,
		w: m.direction_w,
		nw: m.direction_nw
	};

	let activity = $state<ActivityId>(activityChoice.list[0] ?? 'walk');
	let date = $derived(days[0].date);
	let cells = $state<AreaCell[]>([]);
	let failed = $state(false);
	// The grid square the keyboard (or the pointer) is on; the middle one is the place.
	let focus = $state(Math.floor((SIDE * SIDE) / 2));
	let bestName = $state<string | null>(null);
	let container = $state<HTMLDivElement>();

	const from = $derived(date === days[0].date ? `${now.slice(0, 13)}:00` : '');
	const scores = $derived(scoreArea(activities[activity], cells, comfortShift[comfort], from));
	const answer = $derived(betterAnswer(scores, coordinates));
	const reach = $derived(
		cells.length ? distanceAndDirection(coordinates, cells[0]).metres / Math.SQRT2 : 0
	);

	function where(cell: Coordinates) {
		const { metres, toward } = distanceAndDirection(coordinates, cell);
		// Within half a grid step, the point is the place itself.
		if (metres < 12_000) return m.better_here_label();
		return m.better_where({ distance: f.distance(metres), direction: directions[toward]() });
	}

	function describe(score: AreaScore) {
		return score.window
			? m.better_cell({
					where: where(score),
					score: score.score,
					from: f.time(score.window.from),
					until: f.time(score.window.until)
				})
			: m.better_cell_none({ where: where(score), score: score.score });
	}

	const sentence = $derived.by(() => {
		if (!cells.length) return '';
		if (answer.kind === 'nowhere') return m.better_nowhere({ distance: f.distance(reach) });
		if (answer.kind === 'here') {
			const window = answer.here.window!;
			return m.better_here({ from: f.time(window.from), until: f.time(window.until) });
		}
		const { best, here } = answer;
		const times = {
			where: where(best),
			from: f.time(best.window!.from),
			until: f.time(best.window!.until),
			best: best.score,
			here: here.score
		};
		return bestName
			? m.better_better({ place: bestName, ...times })
			: m.better_better_unnamed(times);
	});

	async function nameOf({ lat, lon }: Coordinates): Promise<string | null> {
		const response = await fetch(`/api/reverse?lat=${lat}&lon=${lon}&lang=${getLocale()}`).catch(
			() => null
		);
		if (!response?.ok) return null;
		return ((await response.json()) as { name: string | null }).name;
	}

	// The day's grid; a newer choice wins over an answer still on its way.
	$effect(() => {
		const day = date;
		let current = true;
		failed = false;
		fetch(`/api/area?lat=${coordinates.lat}&lon=${coordinates.lon}&date=${day}`)
			.then((r) => (r.ok ? (r.json() as Promise<AreaCell[]>) : Promise.reject()))
			// Drawn and measured at the points asked for, a regular lattice, not the model's own.
			.then((next) => {
				const points = areaPoints(coordinates);
				if (current) cells = next.map((cell, i) => ({ ...cell, ...points[i] }));
			})
			.catch(() => current && (failed = true));
		return () => (current = false);
	});

	$effect(() => {
		bestName = null;
		if (answer.kind !== 'better') return;
		let current = true;
		nameOf(answer.best).then((name) => current && (bestName = name));
		return () => (current = false);
	});

	async function open(cell: Coordinates) {
		const name = (await nameOf(cell)) ?? '';
		await goto(
			resolve('/p/[coords]/[[name]]', {
				coords: formatCoordinates(cell),
				name: encodeURIComponent(name)
			})
		);
	}

	let map: LeafletMap | undefined;
	let leaflet: typeof import('leaflet') | undefined;
	let squares: Rectangle[] = [];
	let fitted = false;

	onMount(() => {
		let cancelled = false;
		(async () => {
			const L = await import('leaflet');
			await import('leaflet/dist/leaflet.css');
			if (cancelled || !container) return;
			leaflet = L;
			// Arrow keys move between squares here, so Leaflet's own keyboard panning is off.
			map = L.map(container, { keyboard: false, zoomSnap: 0.25, minZoom: 5, maxZoom: 10 });
			map.setView([coordinates.lat, coordinates.lon], 7);
			addBasemap(L, map);
			map.attributionControl.addAttribution(
				'Forecast <a href="https://open-meteo.com/">Open-Meteo</a>'
			);
			draw();
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});

	/** One square per point, filled by how good it is; the focused square gets an outline. */
	function draw() {
		const L = leaflet;
		if (!L || !map || !container || scores.length !== SIDE * SIDE) return;
		const token = (name: string) => getComputedStyle(container!).getPropertyValue(name);
		const [good, ink, sun] = [token('--color-good'), token('--color-ink'), token('--color-sun')];
		const best = answer.kind === 'better' ? scores.indexOf(answer.best) : -1;
		for (const square of squares) square.remove();
		const bounds = areaSquares(coordinates);
		squares = scores.map((score, i) =>
			L.rectangle(bounds[i], {
				color: i === focus ? ink : i === best ? sun : ink,
				weight: i === focus || i === best ? 3 : 0.5,
				opacity: i === focus || i === best ? 1 : 0.3,
				fillColor: good,
				fillOpacity: !score.window ? 0 : score.window.great ? 0.65 : 0.3
			})
				.on('mouseover', () => (focus = i))
				.on('click', () => open(score))
				.addTo(map!)
		);
		if (!fitted) {
			map.fitBounds(squares[0].getBounds().extend(squares.at(-1)!.getBounds()), {
				padding: [8, 8]
			});
			fitted = true;
		}
	}

	$effect(() => {
		void scores;
		void focus;
		draw();
	});

	function onKeydown(event: KeyboardEvent) {
		const row = Math.floor(focus / SIDE);
		const col = focus % SIDE;
		const moves: Record<string, [number, number]> = {
			ArrowUp: [-1, 0],
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1]
		};
		if (event.key === 'Enter' && scores[focus]) {
			event.preventDefault();
			void open(scores[focus]);
			return;
		}
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		const next = {
			row: Math.min(SIDE - 1, Math.max(0, row + move[0])),
			col: Math.min(SIDE - 1, Math.max(0, col + move[1]))
		};
		focus = next.row * SIDE + next.col;
	}
</script>

<section class="mt-4 glass p-4 md:p-6">
	<div class="flex flex-wrap items-end gap-4 px-2">
		<label class="flex flex-col gap-1 text-sm font-semibold">
			{m.better_activity()}
			<select
				bind:value={activity}
				class="min-h-11 cursor-pointer rounded-full bg-veil/10 px-4 text-base outline-1 outline-veil/20 focus-visible:outline-2 focus-visible:outline-veil"
			>
				{#each activityIds as id (id)}
					<option value={id}>{activityLabel(id)}</option>
				{/each}
			</select>
		</label>
		<fieldset>
			<legend class="mb-1 text-sm font-semibold">{m.better_day()}</legend>
			<div class="flex flex-wrap gap-2">
				{#each days as day, i (day.date)}
					<label
						class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
					>
						<input
							type="radio"
							name="better-day"
							value={day.date}
							bind:group={date}
							class="sr-only"
						/>
						{i === 0 ? m.today() : f.weekday(day.date)}
					</label>
				{/each}
			</div>
		</fieldset>
	</div>

	{#if failed}
		<p class="mt-4 px-2">{m.better_failed()}</p>
	{:else}
		<p class="mt-4 flex items-start gap-2 px-2 answer" aria-live="polite">
			<MapPinned size={22} class="mt-1 shrink-0" aria-hidden="true" />
			{sentence}
		</p>
	{/if}

	<!-- An application: arrow keys move between squares, Enter opens one (keys explained below). -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={container}
		role="application"
		tabindex="0"
		aria-label={m.better_map_label({ place })}
		aria-describedby="better-keys"
		onkeydown={onKeydown}
		class="dark-scope mt-4 h-[60vh] max-h-[34rem] min-h-72 overflow-hidden rounded-2xl bg-map forced-color-adjust-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-veil"
	></div>

	<p class="mt-3 min-h-6 px-2 text-sm font-semibold" aria-live="polite">
		{scores[focus] ? describe(scores[focus]) : ''}
	</p>
	<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-sm text-ink-muted">
		{#if answer.kind === 'better'}
			<li class="flex items-center gap-1.5">
				<span class="dark-scope size-3 rounded-sm outline-2 outline-sun" aria-hidden="true"
				></span>{m.better_best_label()}
			</li>
		{/if}
		<li class="flex items-center gap-1.5">
			<span class="dark-scope size-3 rounded-sm bg-good/65" aria-hidden="true"
			></span>{m.window_great()}
		</li>
		<li class="flex items-center gap-1.5">
			<span class="dark-scope size-3 rounded-sm bg-good/30" aria-hidden="true"
			></span>{m.window_good()}
		</li>
		<li class="flex items-center gap-1.5">
			<span class="size-3 rounded-sm outline-1 outline-ink-muted" aria-hidden="true"
			></span>{m.better_poor()}
		</li>
	</ul>
	<p id="better-keys" class="mt-2 px-2 text-sm text-ink-muted">{m.better_keys()}</p>
</section>
