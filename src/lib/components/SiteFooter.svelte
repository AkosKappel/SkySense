<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
</script>

<footer
	class="mt-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1 py-8 text-sm text-ink-muted"
>
	<!-- Attribution required by Open-Meteo's CC BY 4.0 licence. -->
	<a href="https://open-meteo.com/" class="py-2 underline-offset-4 hover:underline" rel="noopener">
		{m.data_attribution()}
	</a>
	<a href={resolve('/map')} data-sveltekit-reload class="py-2 underline-offset-4 hover:underline"
		>{m.map_link()}</a
	>
	<a href={resolve('/about')} class="py-2 underline-offset-4 hover:underline">{m.about()}</a>
	<a href={resolve('/privacy')} class="py-2 underline-offset-4 hover:underline">{m.privacy()}</a>
	<a href={resolve('/settings')} class="py-2 underline-offset-4 hover:underline">{m.settings()}</a>
</footer>
