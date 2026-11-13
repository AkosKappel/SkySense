import { bestWindow, GOOD, type Activity, type ActivityWindow } from '#lib/activities.js';
import { compass } from '#lib/format.js';
import { gridPoints } from '#lib/grid.js';
import type { Coordinates, Day, Hour } from '#lib/weather.js';

// "Where is the weather better?" (M-10): the activity scores the app already computes, for every
// point of a grid around the place, and the point worth the drive.

/** 7 × 7 points about 25 km apart, some 150 km across: one request for a day of all of them. */
export const AREA_SIDE = 7;
const AREA_DEGREES = 0.225;

/** The grid's points as asked for; the model answers with its own nearest points, a little off. */
export function areaPoints(place: Coordinates): Coordinates[] {
	return gridPoints(place, (AREA_SIDE - 1) / 2, AREA_DEGREES);
}

/** Each point's square on the map, edge to edge: south-west and north-east corners, unrounded. */
export function areaSquares({ lat, lon }: Coordinates): [[number, number], [number, number]][] {
	const steps = (AREA_SIDE - 1) / 2;
	const half = {
		lat: AREA_DEGREES / 2,
		lon: AREA_DEGREES / Math.max(0.2, Math.cos((lat * Math.PI) / 180)) / 2
	};
	return Array.from({ length: AREA_SIDE * AREA_SIDE }, (_, i) => {
		const middle = {
			lat: lat + (steps - Math.floor(i / AREA_SIDE)) * AREA_DEGREES,
			lon: lon + ((i % AREA_SIDE) - steps) * half.lon * 2
		};
		return [
			[middle.lat - half.lat, middle.lon - half.lon],
			[middle.lat + half.lat, middle.lon + half.lon]
		];
	});
}

/** One point of the grid: a day of its hours. */
export type AreaCell = { lat: number; lon: number; hours: Hour[]; day: Day | null };

export type AreaScore = {
	lat: number;
	lon: number;
	/** The best window's score, or below GOOD when the point has none. */
	score: number;
	window: ActivityWindow | null;
};

/** Each point's best window for the activity, from `from` on (today: the hours still ahead). */
export function scoreArea(
	activity: Activity,
	cells: AreaCell[],
	shift = 0,
	from = ''
): AreaScore[] {
	return cells.map(({ lat, lon, hours, day }) => {
		const ahead = hours.filter((hour) => hour.time >= from);
		const { window, detail } = bestWindow(activity, ahead, day ? [day] : [], shift);
		return {
			lat,
			lon,
			score: window?.score ?? Math.min(detail?.score ?? 0, GOOD - 1),
			window
		};
	});
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres and the compass point from `a` towards `b`. */
export function distanceAndDirection(a: Coordinates, b: Coordinates) {
	const [lat1, lat2] = [radians(a.lat), radians(b.lat)];
	const dLat = lat2 - lat1;
	const dLon = radians(b.lon - a.lon);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	const metres = 2 * 6_371_000 * Math.asin(Math.sqrt(h));
	const y = Math.sin(dLon) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
	return { metres, toward: compass((Math.atan2(y, x) * 180) / Math.PI) };
}

/** A point has to beat the place by this much to be worth the trip. */
export const BETTER_BY = 5;

export type BetterAnswer =
	| { kind: 'nowhere' }
	| { kind: 'here'; here: AreaScore }
	| { kind: 'better'; best: AreaScore; here: AreaScore };

/**
 * The answer above the map: the best point with a window (the nearer one on a tie), unless the
 * place itself is within BETTER_BY of it.
 */
export function betterAnswer(scores: AreaScore[], place: Coordinates): BetterAnswer {
	const distance = (s: AreaScore) => distanceAndDirection(place, s).metres;
	const here = scores.reduce<AreaScore | null>(
		(a, b) => (!a || distance(b) < distance(a) ? b : a),
		null
	);
	const best = scores
		.filter((s) => s.window)
		.reduce<AreaScore | null>(
			(a, b) =>
				!a || b.score > a.score || (b.score === a.score && distance(b) < distance(a)) ? b : a,
			null
		);
	if (!best || !here) return { kind: 'nowhere' };
	if (here.window && best.score - here.score < BETTER_BY) return { kind: 'here', here };
	return { kind: 'better', best, here };
}
