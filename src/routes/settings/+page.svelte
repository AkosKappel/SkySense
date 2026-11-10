<script lang="ts">
	import { ArrowLeft, Check } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';
	import type { Units } from '#lib/units.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Language names are written in their own language, so everyone finds theirs.
	const languageNames: Record<(typeof locales)[number], string> = {
		en: 'English',
		de: 'Deutsch',
		sk: 'Slovenčina',
		hu: 'Magyar',
		es: 'Español'
	};

	const groups: { name: keyof Units; legend: () => string; options: [string, () => string][] }[] = [
		{
			name: 'temperature',
			legend: m.temperature,
			options: [
				['c', m.celsius],
				['f', m.fahrenheit]
			]
		},
		{
			name: 'wind',
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
			legend: m.rain_amount,
			options: [
				['mm', m.millimetres],
				['in', m.inches]
			]
		},
		{
			name: 'clock',
			legend: m.time_format,
			options: [
				['24', m.clock_24],
				['12', m.clock_12]
			]
		}
	];
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
			<label for="language" class="mb-2 question">{m.language()}</label>
			<select
				id="language"
				name="language"
				class="h-12 w-full rounded-2xl bg-white/10 px-4 text-ink outline-1 outline-white/20"
			>
				{#each locales as locale (locale)}
					<option value={locale} selected={locale === getLocale()} class="text-slate-900"
						>{languageNames[locale]}</option
					>
				{/each}
			</select>
		</div>

		{#each groups as group (group.name)}
			<fieldset>
				<legend class="mb-2 question">{group.legend()}</legend>
				<div class="flex flex-wrap gap-2">
					{#each group.options as [value, label] (value)}
						<label
							class="flex min-h-11 cursor-pointer items-center rounded-full bg-white/10 px-4 font-semibold outline-1 outline-white/20 transition has-checked:bg-white has-checked:text-indigo-950 has-focus-visible:outline-2 has-focus-visible:outline-white"
						>
							<input
								type="radio"
								name={group.name}
								{value}
								checked={data.units[group.name] === value}
								class="sr-only"
							/>
							{label()}
						</label>
					{/each}
				</div>
			</fieldset>
		{/each}

		<button
			type="submit"
			class="h-12 w-full cursor-pointer rounded-full bg-white font-bold text-indigo-950 transition hover:bg-white/90"
			>{m.save()}</button
		>
	</form>

	<SiteFooter />
</main>
