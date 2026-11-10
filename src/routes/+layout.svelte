<script lang="ts">
	import './layout.css';
	import { navigating } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import { m } from '#lib/paraglide/messages.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="description" content={m.tagline()} />
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#1e1b4b" />
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
