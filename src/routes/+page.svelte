<script lang="ts">
	import {
		ArrowDown,
		ArrowUp,
		CalendarRange,
		ChevronRight,
		CloudSun,
		Footprints,
		Layers,
		LocateFixed,
		MapPin,
		Settings,
		Umbrella,
		X
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import PlaceSearch from '#lib/components/PlaceSearch.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import SkyLayer from '#lib/components/SkyLayer.svelte';
	import SummaryLine from '#lib/components/SummaryLine.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import { conditionLabel } from '#lib/components/labels.js';
	import { formatter } from '#lib/format.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { openLive } from '#lib/open-live.js';
	import { pageName, placeKey, savedPlaces, type SavedPlace } from '#lib/places.svelte.js';
	import { formatCoordinates } from '#lib/weather.js';

	let { data }: PageProps = $props();
	const f = $derived(formatter(getLocale(), data.units));
	// Which live sample the hero shows; the page's sky follows it.
	let chosen = $state(0);

	// What the app answers, in its own questions (the tiles' question lines).
	const answers = [
		{ icon: Umbrella, question: m.umbrella_question, text: m.feature_answers },
		{ icon: Footprints, question: m.go_out_question, text: m.feature_activities },
		{ icon: Layers, question: m.models_question, text: m.feature_confidence },
		{ icon: CalendarRange, question: m.normal_question, text: m.feature_normal }
	];

	let removed = $state<{ place: SavedPlace; index: number } | null>(null);
	// Rename, reorder and remove live behind Edit, so a phone row has room for the whole name.
	let editing = $state(false);

	function remove(index: number) {
		const place = savedPlaces.remove(index);
		if (place) removed = { place, index };
	}

	function undo() {
		if (!removed) return;
		savedPlaces.insert(removed.index, removed.place);
		removed = null;
	}
	import type { PageProps } from './$types';
</script>

<svelte:head>
	<title>SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-[88rem] flex-col px-4 pt-4 md:px-8 md:pt-8">
	<header class="flex items-center justify-between">
		<span class="flex items-center gap-2 text-lg font-bold">
			<CloudSun size={24} class="text-sun" aria-hidden="true" /> SkySense
		</span>
		<a
			href={resolve('/settings')}
			aria-label={m.settings()}
			class="grid size-11 pill place-items-center"
		>
			<Settings size={18} aria-hidden="true" />
		</a>
	</header>

	<h1
		class="mt-10 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance md:text-6xl lg:mt-16 lg:text-7xl"
	>
		{m.tagline()}
	</h1>

	<!-- A phone gets the search first; wide screens put the live answer on the left, search right. -->
	<div
		class="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,1fr)] lg:items-start lg:gap-12"
	>
		<div class="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
			<section class="glass p-6">
				<h2 class="answer">{m.home_question()}</h2>
				<div class="mt-6"><PlaceSearch /></div>
			</section>

			{#if savedPlaces.list.length}
				<section class="glass p-6">
					<div class="flex items-center justify-between gap-4">
						<h2 class="question">{m.saved_places()}</h2>
						<button
							type="button"
							class="-my-2 min-h-11 cursor-pointer px-2 font-semibold underline-offset-4 hover:underline"
							aria-pressed={editing}
							onclick={() => (editing = !editing)}>{editing ? m.done() : m.edit()}</button
						>
					</div>
					<ul class="mt-3 space-y-2">
						{#each savedPlaces.list as place, i (placeKey(place))}
							<li class="flex items-center gap-1 rounded-2xl bg-veil/5 outline-1 outline-veil/10">
								{#if !editing}
									<a
										href={resolve('/p/[coords]/[[name]]', {
											coords: formatCoordinates(place),
											name: encodeURIComponent(pageName(place))
										})}
										onclick={(event) => place.live && openLive(event, place, m.my_location())}
										class="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4"
									>
										{#if place.live}<LocateFixed
												size={18}
												class="shrink-0 text-ink-muted"
												aria-hidden="true"
											/>{:else}<MapPin
												size={18}
												class="shrink-0 text-ink-muted"
												aria-hidden="true"
											/>{/if}
										<span class="min-w-0">
											<span class="block truncate font-semibold"
												>{place.live ? m.my_location() : place.name}</span
											>
											{#if place.detail}<span class="block truncate text-sm text-ink-muted"
													>{place.detail}</span
												>{/if}
										</span>
									</a>
								{:else}
									{#if place.live}
										<!-- Its name follows the language; it is the reader's position, not a place to name. -->
										<span class="min-w-0 flex-1 truncate px-4 font-semibold">{m.my_location()}</span
										>
									{:else}
										<input
											aria-label={m.rename_place({ name: place.name })}
											value={place.name}
											maxlength="80"
											enterkeyhint="done"
											class="my-1.5 ml-1.5 h-11 min-w-0 flex-1 rounded-xl bg-veil/10 px-3 font-semibold outline-1 outline-veil/30 focus:outline-2 focus:outline-veil"
											onchange={(event) => savedPlaces.rename(i, event.currentTarget.value)}
											onkeydown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
										/>
									{/if}
									<button
										type="button"
										class="icon-button"
										aria-label={m.move_up({ name: place.name })}
										disabled={i === 0}
										onclick={() => savedPlaces.move(i, -1)}
										><ArrowUp size={18} aria-hidden="true" /></button
									>
									<button
										type="button"
										class="icon-button"
										aria-label={m.move_down({ name: place.name })}
										disabled={i === savedPlaces.list.length - 1}
										onclick={() => savedPlaces.move(i, 1)}
										><ArrowDown size={18} aria-hidden="true" /></button
									>
									<button
										type="button"
										class="mr-1 icon-button"
										aria-label={m.remove_place({ name: place.name })}
										onclick={() => remove(i)}><X size={18} aria-hidden="true" /></button
									>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<div role="status">
				{#if removed}
					<p class="mt-4 flex items-center justify-between gap-4 glass px-5 py-3">
						{m.place_removed({ name: removed.place.name })}
						<button type="button" class="min-h-11 cursor-pointer font-bold underline" onclick={undo}
							>{m.undo()}</button
						>
					</p>
				{/if}
			</div>
		</div>

		<section class="lg:col-start-1 lg:row-start-1" aria-label={m.home_samples()}>
			{#await data.samples then samples}
				{#if samples.length}
					{@const sample = samples[chosen] ?? samples[0]}
					<fieldset>
						<legend class="sr-only">{m.home_samples()}</legend>
						<div class="flex flex-wrap gap-2">
							{#each samples as option, i (option.coords)}
								<label
									class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 text-sm font-semibold outline-1 outline-veil/20 transition has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
								>
									<input
										type="radio"
										name="sample"
										class="sr-only"
										checked={chosen === i}
										onchange={() => (chosen = i)}
									/>
									{option.name}
								</label>
							{/each}
						</div>
					</fieldset>

					<div class="mt-8" aria-live="polite">
						<p class="text-sm font-semibold text-ink-muted">
							{m.home_right_now({ place: sample.name })}
						</p>
						<div class="mt-3">
							<SummaryLine sentences={sample.sentences} {f} large />
						</div>
						<p class="mt-6 flex items-center gap-3 text-lg">
							<WeatherIcon
								condition={sample.condition}
								isDay={sample.isDay}
								size={40}
								strokeWidth={1.5}
							/>
							<span class="text-3xl font-bold tabular-nums">{f.temp(sample.temp)}</span>
							<span class="text-ink-muted">{conditionLabel(sample.condition, sample.isDay)}</span>
						</p>
						<a
							href={resolve('/p/[coords]/[[name]]', {
								coords: sample.coords,
								name: encodeURIComponent(sample.name)
							})}
							class="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
							>{m.home_open({ place: sample.name })}
							<ChevronRight size={18} aria-hidden="true" /></a
						>
					</div>
					<SkyLayer kind={sample.sky} falling={null} />
				{/if}
			{/await}
		</section>
	</div>

	<section class="mt-16 lg:mt-24">
		<h2 class="text-2xl font-extrabold tracking-tight">{m.home_answers()}</h2>
		<ul class="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
			{#each answers as { icon: Icon, question, text } (question)}
				<li>
					<Icon size={28} strokeWidth={1.5} class="text-sun" aria-hidden="true" />
					<h3 class="mt-3 text-lg font-bold">{question()}</h3>
					<p class="mt-2 text-ink-muted">{text()}</p>
				</li>
			{/each}
		</ul>
	</section>

	<SiteFooter />
</main>
