<script lang="ts">
	import { LoaderCircle, LocateFixed, MapPin, Search } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
	import { formatCoordinates } from '#lib/weather.js';

	type Result = { id: number; name: string; detail: string; lat: number; lon: number };

	let query = $state('');
	let results = $state<Result[]>([]);
	let active = $state(-1);
	let status = $state<'idle' | 'searching' | 'empty' | 'error'>('idle');
	let locating = $state(false);
	let locationError = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	let latest = 0;

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
				const params = new URLSearchParams({ q, lang: getLocale() });
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

	function openPlace(place: SavedPlace) {
		savedPlaces.add(place);
		goto(
			resolve('/p/[coords]/[[name]]', {
				coords: formatCoordinates(place),
				name: encodeURIComponent(place.name)
			})
		);
	}

	function choose(result: Result) {
		openPlace({ name: result.name, detail: result.detail, lat: result.lat, lon: result.lon });
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
		} else if (event.key === 'Escape') {
			results = [];
		}
	}

	function locate() {
		locationError = '';
		if (!('geolocation' in navigator)) {
			locationError = m.location_unavailable();
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				locating = false;
				openPlace({ name: m.my_location(), lat: coords.latitude, lon: coords.longitude });
			},
			(error) => {
				locating = false;
				locationError =
					error.code === error.PERMISSION_DENIED ? m.location_denied() : m.location_unavailable();
			},
			{ timeout: 10000, maximumAge: 600000 }
		);
	}
</script>

<div class="relative">
	<label for="place-search" class="mb-2 question">{m.search_label()}</label>
	<div class="relative">
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
			bind:value={query}
			oninput={search}
			{onkeydown}
			role="combobox"
			aria-expanded={open}
			aria-controls="place-results"
			aria-autocomplete="list"
			aria-activedescendant={open && active >= 0 ? `place-${results[active].id}` : undefined}
			class="h-14 w-full rounded-2xl bg-white/10 pr-12 pl-12 text-lg text-ink outline-1 outline-white/20 placeholder:text-ink-muted focus:bg-white/15 focus:outline-2 focus:outline-white [&::-webkit-search-cancel-button]:hidden"
		/>
		{#if status === 'searching'}
			<LoaderCircle
				size={20}
				class="absolute top-1/2 right-4 -translate-y-1/2 animate-spin text-ink-muted motion-reduce:animate-none"
				aria-hidden="true"
			/>
		{/if}
	</div>

	{#if open}
		<ul
			id="place-results"
			role="listbox"
			aria-label={m.search_label()}
			class="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-tile bg-indigo-950 p-1 shadow-2xl outline-1 outline-white/15"
		>
			{#each results as result, i (result.id)}
				<li
					id="place-{result.id}"
					role="option"
					aria-selected={i === active}
					class="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 {i === active
						? 'bg-white/15'
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

	<p class="mt-2 min-h-5 text-sm text-ink-muted" role="status">
		{#if status === 'empty'}{m.search_no_results({ query: query.trim() })}{/if}
		{#if status === 'error'}{m.search_error()}{/if}
	</p>

	<button
		type="button"
		onclick={locate}
		disabled={locating}
		class="mt-2 flex h-12 cursor-pointer items-center gap-2 rounded-full bg-white/10 px-5 font-semibold outline-1 outline-white/20 transition hover:bg-white/20 disabled:cursor-wait"
	>
		{#if locating}
			<LoaderCircle size={18} class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
			{m.locating()}
		{:else}
			<LocateFixed size={18} aria-hidden="true" />
			{m.use_my_location()}
		{/if}
	</button>
	{#if locationError}<p class="mt-2 text-sm" role="alert">{locationError}</p>{/if}
</div>
