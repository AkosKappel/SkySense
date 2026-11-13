<script lang="ts">
	import { LoaderCircle, LocateFixed, MapPin, Search, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isSearchShortcut } from '#lib/keys.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { locate } from '#lib/locate.js';
	import { areaName } from '#lib/open-live.js';
	import { savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
	import { formatCoordinates } from '#lib/weather.js';

	type Result = { id: number; name: string; detail: string; lat: number; lon: number };

	/**
	 * `replace` swaps the current history entry, so Back skips the sheet the search was opened in.
	 * `to` is where a chosen place opens: its forecast, or the map around it (M-11). `compact` fits
	 * the search on one line above a map: the label only for screen readers, location as an icon.
	 */
	let {
		replace = false,
		to = 'place',
		compact = false
	}: { replace?: boolean; to?: 'place' | 'map'; compact?: boolean } = $props();

	let query = $state('');
	let results = $state<Result[]>([]);
	let active = $state(-1);
	let status = $state<'idle' | 'searching' | 'empty' | 'error'>('idle');
	let locating = $state(false);
	let locationError = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;
	let input: HTMLInputElement;

	const open = $derived(results.length > 0);

	function search() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			status = 'idle';
			return;
		}
		timer = setTimeout(async () => {
			const request = ++latest;
			status = 'searching';
			try {
				// The browser's region ("SK" in "sk-SK") moves that country's places up.
				const country = new Intl.Locale(navigator.language).region;
				// Lower case: the geocoder ignores case, and one URL per query gives more CDN hits.
				const params = new URLSearchParams({
					q: q.toLocaleLowerCase(),
					lang: getLocale(),
					...(country && { country })
				});
				const response = await fetch(`/api/places?${params}`);
				if (!response.ok) throw new Error(String(response.status));
				const found: Result[] = await response.json();
				if (request !== latest) return;
				results = found;
				active = found.length ? 0 : -1;
				status = found.length ? 'idle' : 'empty';
			} catch {
				if (request !== latest) return;
				results = [];
				status = 'error';
			}
		}, 250);
	}

	function openPlace(place: SavedPlace, save = true) {
		if (save) savedPlaces.add(place);
		// On the map page the search stays on screen, so it closes its list after a choice.
		results = [];
		query = '';
		const params = { coords: formatCoordinates(place), name: encodeURIComponent(place.name) };
		goto(
			to === 'map'
				? resolve('/map/[coords]/[[name]]', params)
				: resolve('/p/[coords]/[[name]]', params),
			{ replace }
		);
	}

	function choose(result: Result) {
		openPlace({ name: result.name, detail: result.detail, lat: result.lat, lon: result.lon });
	}

	function clear() {
		query = '';
		search();
		input.focus();
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (!isSearchShortcut(event)) return;
		event.preventDefault();
		input.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && open) {
			event.preventDefault();
			active = (active + 1) % results.length;
		} else if (event.key === 'ArrowUp' && open) {
			event.preventDefault();
			active = (active - 1 + results.length) % results.length;
		} else if (event.key === 'Enter' && open && active >= 0) {
			event.preventDefault();
			choose(results[active]);
		} else if (event.key === 'Escape' && open) {
			// Close the results first; a second Escape closes the sheet around the field.
			event.preventDefault();
			results = [];
		}
	}

	async function useMyLocation() {
		locationError = '';
		locating = true;
		try {
			const position = await locate();
			const area = await areaName(position);
			savedPlaces.setLive({ name: m.my_location(), detail: area, ...position });
			openPlace({ name: area ?? m.my_location(), ...position }, false);
		} catch (error) {
			locationError = error === 'denied' ? m.location_denied() : m.location_unavailable();
		} finally {
			locating = false;
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="relative">
	<label for="place-search" class={compact ? 'sr-only' : 'mb-2 question'}>{m.search_label()}</label>
	<div class="flex gap-2">
		<div class="relative flex-1">
			<Search
				size={20}
				class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
				aria-hidden="true"
			/>
			<input
				id="place-search"
				type="search"
				autocomplete="off"
				spellcheck="false"
				placeholder={m.search_placeholder()}
				bind:this={input}
				bind:value={query}
				oninput={search}
				{onkeydown}
				role="combobox"
				aria-expanded={open}
				aria-controls="place-results"
				aria-autocomplete="list"
				aria-activedescendant={open && active >= 0 ? `place-${results[active].id}` : undefined}
				class="{compact
					? 'h-12 text-base'
					: 'h-14 text-lg'} w-full rounded-2xl bg-veil/10 pr-12 pl-12 text-ink outline-1 outline-veil/20 placeholder:text-ink-muted focus:bg-veil/15 focus:outline-2 focus:outline-veil [&::-webkit-search-cancel-button]:hidden"
			/>
			{#if status === 'searching'}
				<LoaderCircle
					size={20}
					class="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-ink-muted motion-reduce:animate-none"
					aria-hidden="true"
				/>
			{:else if query}
				<button
					type="button"
					class="absolute top-1/2 right-1.5 icon-button -translate-y-1/2"
					aria-label={m.clear_search()}
					onclick={clear}><X size={20} aria-hidden="true" /></button
				>
			{/if}
		</div>
		{#if compact}
			<button
				type="button"
				onclick={useMyLocation}
				disabled={locating}
				aria-label={locating ? m.locating() : m.use_my_location()}
				class="grid size-12 shrink-0 pill cursor-pointer place-items-center disabled:cursor-wait"
			>
				{#if locating}
					<LoaderCircle
						size={18}
						class="animate-spin motion-reduce:animate-none"
						aria-hidden="true"
					/>
				{:else}
					<LocateFixed size={18} aria-hidden="true" />
				{/if}
			</button>
		{/if}
	</div>

	{#if open}
		<ul
			id="place-results"
			role="listbox"
			aria-label={m.search_label()}
			class="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-tile bg-surface p-1 shadow-2xl outline-1 outline-veil/15"
		>
			{#each results as result, i (result.id)}
				<li
					id="place-{result.id}"
					role="option"
					aria-selected={i === active}
					class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 {i === active
						? 'bg-veil/15'
						: ''}"
					onpointerenter={() => (active = i)}
					onclick={() => choose(result)}
					onkeydown={() => {}}
				>
					<MapPin size={18} class="shrink-0 text-ink-muted" aria-hidden="true" />
					<span>
						<span class="block font-semibold">{result.name}</span>
						{#if result.detail}<span class="block text-sm text-ink-muted">{result.detail}</span
							>{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Compact, it floats under the field instead of keeping a line free. -->
	<p
		class="text-sm text-ink-muted {compact ? 'absolute top-full mt-1' : 'mt-2 min-h-5'}"
		role="status"
	>
		{#if status === 'empty'}{m.search_no_results({ query: query.trim() })}{/if}
		{#if status === 'error'}{m.search_error()}{/if}
	</p>

	{#if !compact}
		<button
			type="button"
			onclick={useMyLocation}
			disabled={locating}
			class="mt-2 flex h-12 cursor-pointer items-center gap-2 rounded-full bg-veil/10 px-5 font-semibold outline-1 outline-veil/20 transition hover:bg-veil/20 disabled:cursor-wait"
		>
			{#if locating}
				<LoaderCircle
					size={18}
					class="animate-spin motion-reduce:animate-none"
					aria-hidden="true"
				/>
				{m.locating()}
			{:else}
				<LocateFixed size={18} aria-hidden="true" />
				{m.use_my_location()}
			{/if}
		</button>
	{/if}
	{#if locationError}<p class="mt-2 text-sm" role="alert">{locationError}</p>{/if}
</div>
