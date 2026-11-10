// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** `search` opens it with the search field focused, for the `/` shortcut. */
			placeSheet?: true | 'search';
		}
		// interface Platform {}
	}
}

export {};
