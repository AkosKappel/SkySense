// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			/** A short id, logged with the error, so a report can be matched with the logs (T-14). */
			id?: string;
		}
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
