// Which activities the "When should I go out?" tile shows (S-08). Stays on this device, guarded
// like saved places so blocked storage never breaks the page.
import { browser } from '$app/env';
import { activityIds, type ActivityId } from '#lib/activities.js';

const KEY = 'skysense.activities';
export const DEFAULT_ACTIVITIES: ActivityId[] = ['run', 'walk', 'laundry'];

function read(): ActivityId[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		if (!Array.isArray(parsed)) return DEFAULT_ACTIVITIES;
		return activityIds.filter((id) => parsed.includes(id));
	} catch {
		return DEFAULT_ACTIVITIES;
	}
}

class ActivityChoice {
	list = $state<ActivityId[]>(browser ? read() : DEFAULT_ACTIVITIES);

	constructor() {
		// Kept in step with other tabs, like saved places.
		if (browser) {
			addEventListener('storage', (event) => {
				if (event.key === KEY || event.key === null) this.list = read();
			});
		}
	}

	toggle(id: ActivityId) {
		this.list = this.list.includes(id)
			? this.list.filter((x) => x !== id)
			: activityIds.filter((x) => x === id || this.list.includes(x));
		try {
			localStorage.setItem(KEY, JSON.stringify(this.list));
		} catch {
			// Not stored: the choice still holds until the page closes.
		}
	}
}

export const activityChoice = new ActivityChoice();
