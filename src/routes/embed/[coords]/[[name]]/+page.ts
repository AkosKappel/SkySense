import { loadPlace } from '#lib/load-place.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, fetch }) => loadPlace(params, fetch);
