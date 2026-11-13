import {
	Bike,
	Camera,
	Dog,
	Footprints,
	Mountain,
	Sandwich,
	Shirt,
	Telescope
} from '@lucide/svelte';
import type { ActivityId } from '#lib/activities.js';

export const activityIcons: Record<ActivityId, typeof Bike> = {
	run: Footprints,
	cycle: Bike,
	walk: Dog,
	hike: Mountain,
	picnic: Sandwich,
	laundry: Shirt,
	stars: Telescope,
	golden: Camera
};
