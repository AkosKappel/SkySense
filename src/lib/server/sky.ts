import { Body, Observer, SearchMoonPhase, SearchRiseSet, type AstroTime } from 'astronomy-engine';
import type { Coordinates, Sky } from '#lib/weather.js';

/**
 * The moon's next rise and set, and its next full and new moon (H-07), as the place's wall-clock
 * times. Computed on the server, so the library never reaches the browser. `now` is the forecast's
 * current local time; the place's offset now is used for the whole month, so a daylight saving
 * change before the next full moon moves that time by an hour, never its date by more than that.
 */
export function skyEvents(coordinates: Coordinates, now: string, utcOffsetSeconds: number): Sky {
	const offset = utcOffsetSeconds * 1000;
	const start = new Date(Date.parse(`${now}Z`) - offset);
	const local = (time: AstroTime | null) =>
		time ? new Date(time.date.getTime() + offset).toISOString().slice(0, 16) : null;
	const observer = new Observer(coordinates.lat, coordinates.lon, 0);
	// Within a day, or none: near the poles the moon can stay up or down for days.
	const rise = SearchRiseSet(Body.Moon, observer, +1, start, 1);
	const set = SearchRiseSet(Body.Moon, observer, -1, start, 1);
	return {
		moonrise: local(rise),
		moonset: local(set),
		fullMoon: local(SearchMoonPhase(180, start, 31))!,
		newMoon: local(SearchMoonPhase(0, start, 31))!
	};
}
