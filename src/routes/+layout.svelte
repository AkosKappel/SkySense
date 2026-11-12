<script lang="ts">
	import './layout.css';
	import { onNavigate } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// Place switches and day views cross-fade (U-08), where the browser supports it and the reader
	// has not asked for less motion.
	onNavigate((navigation) => {
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			return;
		}
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<meta name="description" content={m.tagline()} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="SkySense" />
	<meta property="og:title" content="SkySense" />
	<meta property="og:description" content={m.tagline()} />
	<meta property="og:locale" content={getLocale()} />
	<meta property="og:image" content="{page.url.origin}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={m.og_image_alt()} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<!-- The browser's bar matches the default sky; SkyLayer sets a place's own. -->
	{#if data.theme === 'system'}
		<meta name="theme-color" content="#c7d2fe" media="(prefers-color-scheme: light)" />
		<meta name="theme-color" content="#1e1b4b" media="(prefers-color-scheme: dark)" />
	{:else}
		<meta name="theme-color" content={data.theme === 'light' ? '#c7d2fe' : '#1e1b4b'} />
	{/if}
</svelte:head>

<!-- A thin bar while a client navigation loads; the old page stays put, so nothing jumps. -->
<div class="fixed inset-x-0 top-0 z-50 h-0.5" aria-live="polite">
	{#if navigating.to}
		<div class="h-full animate-pulse bg-sun motion-reduce:animate-none"></div>
		<span class="sr-only">{m.loading_forecast()}</span>
	{/if}
</div>

<div class="contents" aria-busy={navigating.to ? 'true' : undefined}>
	{@render children()}
</div>
