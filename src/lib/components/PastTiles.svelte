<script lang="ts">
	import ClimateTiles from '#lib/components/ClimateTiles.svelte';
	import DryTile from '#lib/components/DryTile.svelte';
	import GardenTile from '#lib/components/GardenTile.svelte';
	import HindcastTile from '#lib/components/HindcastTile.svelte';
	import type { Formatter } from '#lib/format.js';
	import type { Coordinates, Day } from '#lib/weather.js';

	// The tiles about the past and the ground (the climate normal, past years, the dry spell, the
	// garden, the forecast check), one chunk the place page loads when they come near (`WhenNear`).
	let { coordinates, today, f }: { coordinates: Coordinates; today: Day; f: Formatter } = $props();
</script>

<ClimateTiles {coordinates} {today} {f}>
	<DryTile {coordinates} today={today.date} {f} />
	<GardenTile {coordinates} today={today.date} {f} />
	<HindcastTile {coordinates} today={today.date} {f} />
</ClimateTiles>
