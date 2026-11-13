<script lang="ts">
	import {
		ArrowLeft,
		CalendarRange,
		CloudRain,
		Gauge,
		Layers,
		Leaf,
		MapPinned,
		MessageSquareText,
		Settings,
		Shirt,
		Sparkles,
		Star,
		Sunset,
		Tablet,
		WifiOff
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { m } from '#lib/paraglide/messages.js';

	// Every feature once, in plain words (P-07); add a line when a feature lands.
	const features = [
		[MessageSquareText, m.feature_answers],
		[Sparkles, m.feature_activities],
		[CalendarRange, m.feature_week],
		[Shirt, m.feature_comfort],
		[Layers, m.feature_confidence],
		[Gauge, m.feature_normal],
		[Leaf, m.feature_air],
		[CloudRain, m.feature_radar],
		[MapPinned, m.feature_better],
		[Sunset, m.feature_sky],
		[Star, m.feature_places],
		[Tablet, m.feature_wall],
		[WifiOff, m.feature_offline],
		[Settings, m.feature_settings]
	] as const;
</script>

<svelte:head>
	<title>{m.about()} · SkySense</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pt-4">
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
		<ul class="space-y-3">
			{#each features as [Icon, feature] (feature)}
				<li class="flex gap-3">
					<Icon size={20} class="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
					<span>{feature()}</span>
				</li>
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
