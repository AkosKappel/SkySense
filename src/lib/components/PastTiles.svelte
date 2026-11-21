<script lang="ts">
	import ClimateTiles from '#lib/components/ClimateTiles.svelte';
	import DryTile from '#lib/components/DryTile.svelte';
	import HindcastTile from '#lib/components/HindcastTile.svelte';
	import type { Formatter } from '#lib/format.js';
	import type { Coordinates } from '#lib/weather.js';

	// The tiles about the past (the climate normal, past years, the dry spell, the forecast check),
	// one chunk the place page loads when they come near (`WhenNear`).
	let {
		coordinates,
		date,
		max,
		place,
		f
	}: { coordinates: Coordinates; date: string; max: number; place: string; f: Formatter } =
		$props();
</script>

<ClimateTiles {coordinates} {date} {max} {place} {f}>
	<DryTile {coordinates} today={date} {f} />
	<HindcastTile {coordinates} today={date} {f} />
</ClimateTiles>
