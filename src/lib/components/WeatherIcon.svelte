<script lang="ts">
	import {
		Cloud,
		CloudDrizzle,
		CloudFog,
		CloudLightning,
		CloudMoon,
		CloudRain,
		CloudRainWind,
		CloudSnow,
		CloudSun,
		Moon,
		Sun
	} from '@lucide/svelte';
	import type { Condition } from '#lib/weather.js';

	let {
		condition,
		isDay = true,
		size = 24,
		strokeWidth = 2,
		animated = false,
		halo = false,
		class: className = ''
	}: {
		condition: Condition;
		isDay?: boolean;
		size?: number;
		strokeWidth?: number;
		/** Small motion that matches the weather (U-14, keyframes in `layout.css`). */
		animated?: boolean;
		/** A soft glow in the weather's colour behind a large icon (U-22), taking no more room than the icon. */
		halo?: boolean;
		class?: string;
	} = $props();

	const icons = {
		clear: [Sun, Moon],
		partly: [CloudSun, CloudMoon],
		cloudy: [Cloud, Cloud],
		fog: [CloudFog, CloudFog],
		drizzle: [CloudDrizzle, CloudDrizzle],
		rain: [CloudRain, CloudRain],
		showers: [CloudRainWind, CloudRainWind],
		snow: [CloudSnow, CloudSnow],
		thunder: [CloudLightning, CloudLightning]
	} as const;

	const wet = ['drizzle', 'rain', 'showers', 'snow', 'thunder'];
	const Icon = $derived(icons[condition][isDay ? 0 : 1]);
	// Amber only where the sun or moon is in the icon; plain cloud and fog stay neutral.
	const tone = $derived(
		wet.includes(condition)
			? 'text-rain'
			: condition === 'cloudy' || condition === 'fog'
				? 'text-ink'
				: isDay
					? 'text-sun'
					: 'text-sun-soft'
	);
	const glow = $derived(
		wet.includes(condition)
			? 'from-rain/25'
			: condition === 'cloudy' || condition === 'fog'
				? 'from-veil/15'
				: 'from-sun/30'
	);
	const motion = $derived(
		!animated
			? ''
			: condition === 'thunder'
				? 'icon-flash'
				: wet.includes(condition)
					? 'icon-fall'
					: condition === 'clear' && isDay
						? 'icon-spin'
						: 'icon-drift'
	);
</script>

{#if halo}
	<span
		class="grid shrink-0 place-items-center rounded-full bg-radial {glow} to-transparent to-70% forced-colors:bg-none {className}"
		style:width="{size * 1.6}px"
		style:height="{size * 1.6}px"
		style:margin="-{size * 0.3}px"
		aria-hidden="true"
	>
		<Icon {size} {strokeWidth} class="{tone} {motion}" aria-hidden="true" />
	</span>
{:else}
	<Icon {size} {strokeWidth} class="{tone} {motion} {className}" aria-hidden="true" />
{/if}
