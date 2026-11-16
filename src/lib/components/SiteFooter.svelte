<script lang="ts" module>
	import type { Locale } from '#lib/paraglide/runtime.js';

	/** Each language in its own words, so everyone finds theirs (Settings uses it too). */
	export const languageNames: Record<Locale, string> = {
		en: 'English',
		de: 'Deutsch',
		sk: 'Slovenčina',
		hu: 'Magyar',
		es: 'Español'
	};
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';

	// U-17: names, not flags (a flag is a country, and Spanish or English belong to many). Plain
	// links that set the language cookie on the server and come back here.
	const back = $derived(encodeURIComponent(page.url.pathname + page.url.search));
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
	<nav aria-label={m.language()} class="flex basis-full flex-wrap justify-center gap-x-4">
		{#each locales as locale (locale)}
			{#if locale === getLocale()}
				<span class="py-2 font-semibold text-ink" aria-current="true">{languageNames[locale]}</span>
			{:else}
				<a
					href="{resolve('/language/[locale]', { locale })}?to={back}"
					hreflang={locale}
					lang={locale}
					rel="nofollow"
					data-sveltekit-reload
					class="py-2 underline-offset-4 hover:underline">{languageNames[locale]}</a
				>
			{/if}
		{/each}
	</nav>
</footer>
