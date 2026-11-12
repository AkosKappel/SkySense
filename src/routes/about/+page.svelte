<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Every feature once, in plain words (P-07); add a line when a feature lands.
	const features = [
		m.feature_answers,
		m.feature_activities,
		m.feature_comfort,
		m.feature_confidence,
		m.feature_normal,
		m.feature_air,
		m.feature_radar,
		m.feature_sky,
		m.feature_places,
		m.feature_offline,
		m.feature_settings
	];
</script>

<svelte:head>
	<title>{m.about()} · SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-4">
	<header class="flex items-center gap-3">
		<a href={resolve('/')} aria-label={m.back()} class="grid size-11 pill place-items-center">
			<ArrowLeft size={18} aria-hidden="true" />
		</a>
		<h1 class="text-2xl font-extrabold">{m.about_title()}</h1>
	</header>

	<article class="mt-6 space-y-4 glass p-6 leading-relaxed">
		<p class="answer">{m.tagline()}</p>
		<p>{m.about_what()}</p>
		<h2 class="question pt-2">{m.about_features()}</h2>
		<ul class="list-disc space-y-2 pl-5 marker:text-ink-muted">
			{#each features as feature (feature)}
				<li>{feature()}</li>
			{/each}
		</ul>
		<p>{m.about_data()}</p>
		<p>
			{m.about_places()}
			<a
				href="https://www.openstreetmap.org/copyright"
				class="font-semibold underline underline-offset-4"
				rel="noopener">© OpenStreetMap contributors</a
			>
			· ODbL
		</p>
		<p>{m.about_languages()}</p>
		<p>
			<a
				href="https://open-meteo.com/"
				class="font-semibold underline underline-offset-4"
				rel="noopener">{m.data_attribution()}</a
			>
			· CC BY 4.0
		</p>
	</article>

	<SiteFooter />
</main>
