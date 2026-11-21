<script lang="ts">
	import {
		ArrowLeft,
		Check,
		ChevronDown,
		Clock,
		Droplets,
		Languages,
		LayoutGrid,
		Palette,
		Shirt,
		Thermometer,
		Wind
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SiteFooter, { languageNames } from '#lib/components/SiteFooter.svelte';
	import { tileName } from '#lib/components/tile-names.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';
	import type { Units } from '#lib/units.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const groups: {
		name: keyof Units | 'comfort' | 'theme';
		legend: () => string;
		icon: typeof Clock;
		note?: () => string;
		options: [string, () => string][];
	}[] = [
		{
			name: 'theme',
			icon: Palette,
			legend: m.theme,
			note: m.theme_weather_note,
			options: [
				['system', m.theme_system],
				['dark', m.theme_dark],
				['light', m.theme_light],
				['weather', m.theme_weather]
			]
		},
		{
			name: 'temperature',
			icon: Thermometer,
			legend: m.temperature,
			options: [
				['c', m.celsius],
				['f', m.fahrenheit]
			]
		},
		{
			name: 'wind',
			icon: Wind,
			legend: m.wind_speed,
			options: [
				['kmh', () => 'km/h'],
				['ms', () => 'm/s'],
				['mph', () => 'mph'],
				['kn', m.knots],
				['bft', m.beaufort]
			]
		},
		{
			name: 'rain',
			icon: Droplets,
			legend: m.rain_amount,
			options: [
				['mm', m.millimetres],
				['in', m.inches]
			]
		},
		{
			name: 'clock',
			icon: Clock,
			legend: m.time_format,
			options: [
				['24', m.clock_24],
				['12', m.clock_12]
			]
		},
		{
			name: 'comfort',
			icon: Shirt,
			legend: m.comfort_profile,
			note: m.comfort_note,
			options: [
				['cold', m.comfort_cold],
				['neutral', m.comfort_neutral],
				['warm', m.comfort_warm]
			]
		}
	];
	const chosen = $derived({ ...data.units, comfort: data.comfort, theme: data.theme });
</script>

<svelte:head>
	<title>{m.settings()} · SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
	<header class="flex items-center gap-3">
		<a href={resolve('/')} aria-label={m.back()} class="grid size-11 pill place-items-center">
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{m.settings()}</h1>
	</header>

	{#if page.url.searchParams.has('saved')}
		<p class="mt-6 flex items-center gap-2 glass px-5 py-3 font-semibold" role="status">
			<Check size={18} class="text-good" aria-hidden="true" />
			{m.settings_saved()}
		</p>
	{/if}

	<form method="POST" class="mt-6 space-y-6 glass p-6">
		<div>
			<label for="language" class="mb-2 question">
				<Languages size={18} aria-hidden="true" />
				{m.language()}
			</label>
			<div class="relative">
				<select
					id="language"
					name="language"
					class="h-12 w-full cursor-pointer appearance-none rounded-2xl bg-veil/10 pr-12 pl-4 text-ink outline-1 outline-veil/20"
				>
					{#each locales as locale (locale)}
						<option value={locale} selected={locale === getLocale()}>
							{languageNames[locale]}
						</option>
					{/each}
				</select>
				<ChevronDown
					size={18}
					class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted"
					aria-hidden="true"
				/>
			</div>
		</div>

		{#each groups as group (group.name)}
			<fieldset>
				<legend class="mb-2 question">
					<group.icon size={18} aria-hidden="true" />
					{group.legend()}
				</legend>
				<div class="flex flex-wrap gap-2">
					{#each group.options as [value, label] (value)}
						<label
							class="flex min-h-11 cursor-pointer items-center rounded-full bg-veil/10 px-4 font-semibold outline-1 outline-veil/20 transition has-checked:bg-veil has-checked:text-on-veil has-focus-visible:outline-2 has-focus-visible:outline-veil"
						>
							<input
								type="radio"
								name={group.name}
								{value}
								checked={chosen[group.name] === value}
								class="sr-only"
							/>
							{label()}
						</label>
					{/each}
				</div>
				{#if group.note}<p class="mt-2 text-sm text-ink-muted">{group.note()}</p>{/if}
			</fieldset>
		{/each}

		<!-- U-26: tiles come back here as well as in the edit mode on a place page. -->
		<fieldset>
			<legend class="mb-2 question">
				<LayoutGrid size={18} aria-hidden="true" />
				{m.tiles_settings()}
			</legend>
			<div class="grid gap-1">
				{#each data.tiles as tile (tile.id)}
					<label class="flex min-h-11 cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							name="tile"
							value={tile.id}
							checked={!tile.hidden}
							class="size-5 accent-current"
						/>
						{tileName(tile.id)}
					</label>
				{/each}
			</div>
			<p class="mt-2 text-sm text-ink-muted">{m.tiles_settings_note()}</p>
			<button
				type="submit"
				name="tiles"
				value="reset"
				class="mt-2 min-h-11 cursor-pointer text-sm font-semibold underline-offset-4 hover:underline"
			>
				{m.tiles_reset()}
			</button>
		</fieldset>

		<button
			type="submit"
			class="h-12 w-full cursor-pointer rounded-full bg-veil font-bold text-on-veil transition hover:bg-veil/90"
		>
			{m.save()}
		</button>
	</form>

	<SiteFooter />
</main>
