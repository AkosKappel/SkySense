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
		class: className = ''
	}: {
		condition: Condition;
		isDay?: boolean;
		size?: number;
		strokeWidth?: number;
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
	const tone = $derived(
		wet.includes(condition) ? 'text-rain' : isDay ? 'text-sun' : 'text-sun-soft'
	);
</script>

<Icon {size} {strokeWidth} class="{tone} {className}" aria-hidden="true" />
