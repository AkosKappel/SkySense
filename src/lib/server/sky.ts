import {
	Body,
	Equator,
	Horizon,
	Illumination,
	Observer,
	SearchAltitude,
	SearchLocalSolarEclipse,
	SearchLunarEclipse,
	SearchMoonPhase,
	SearchRiseSet,
	type AstroTime
} from 'astronomy-engine';
import type { Coordinates, Planet, Sky, SkyEclipse } from '#lib/weather.js';

const DAY_MS = 86_400_000;
/** Eclipses further ahead than this are left for later visits. */
const ECLIPSE_DAYS = 14;
/** Planets counted as easy to see: up this high an hour or so after dusk, and this bright. */
const PLANET_ALTITUDE = 10;
const PLANET_MAGNITUDE = 1.5;
/** The sun this far below the horizon makes the sky dark enough for planets (nautical dusk). */
const DUSK_ALTITUDE = -9;
const planets: [Planet, Body][] = [
	['venus', Body.Venus],
	['jupiter', Body.Jupiter],
	['mars', Body.Mars],
	['saturn', Body.Saturn]
];

const altitude = (body: Body, time: Date, observer: Observer) => {
	const { ra, dec } = Equator(body, time, observer, true, true);
	return Horizon(time, observer, ra, dec, 'normal').altitude;
};

/**
 * The moon's next rise and set, its next full and new moon, an eclipse in the next two weeks that
 * can be seen from the place, and the bright planets up after dusk tonight (H-07), as the place's
 * wall-clock times. Computed on the server, so the library never reaches the browser. `now` is
 * the forecast's current local time; the place's offset now is used for the whole month, so a
 * daylight saving change before the next full moon moves that time by an hour, never its date by
 * more than that.
 */
export function skyEvents(coordinates: Coordinates, now: string, utcOffsetSeconds: number): Sky {
	const offset = utcOffsetSeconds * 1000;
	const start = new Date(Date.parse(`${now}Z`) - offset);
	const local = (time: AstroTime | Date | null) =>
		time
			? new Date((time instanceof Date ? time : time.date).getTime() + offset)
					.toISOString()
					.slice(0, 16)
			: null;
	const observer = new Observer(coordinates.lat, coordinates.lon, 0);
	// Within a day, or none: near the poles the moon can stay up or down for days.
	const rise = SearchRiseSet(Body.Moon, observer, +1, start, 1);
	const set = SearchRiseSet(Body.Moon, observer, -1, start, 1);
	return {
		moonrise: local(rise),
		moonset: local(set),
		fullMoon: local(SearchMoonPhase(180, start, 31))!,
		newMoon: local(SearchMoonPhase(0, start, 31))!,
		eclipse: nextEclipse(observer, start, local),
		planets: planetsTonight(observer, `${now.slice(0, 10)}T12:00`, offset)
	};
}

function nextEclipse(
	observer: Observer,
	start: Date,
	local: (time: AstroTime) => string | null
): SkyEclipse | null {
	const until = start.getTime() + ECLIPSE_DAYS * DAY_MS;
	const found: SkyEclipse[] = [];
	const lunar = SearchLunarEclipse(start);
	// A penumbral eclipse only dims the moon slightly, too little to point anyone at.
	if (
		lunar.kind !== 'penumbral' &&
		lunar.peak.date.getTime() < until &&
		altitude(Body.Moon, lunar.peak.date, observer) > 0
	) {
		found.push({ body: 'moon', kind: lunar.kind as 'partial' | 'total', at: local(lunar.peak)! });
	}
	const solar = SearchLocalSolarEclipse(start, observer);
	if (solar.peak.time.date.getTime() < until && solar.peak.altitude > 0) {
		found.push({
			body: 'sun',
			kind: solar.kind as 'partial' | 'annular' | 'total',
			at: local(solar.peak.time)!
		});
	}
	return found.sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
}

/** The bright planets above the horizon an hour after tonight's dusk, brightest first. */
function planetsTonight(observer: Observer, noon: string, offset: number): Planet[] {
	const fromNoon = new Date(Date.parse(`${noon}Z`) - offset);
	const dusk = SearchAltitude(Body.Sun, observer, -1, fromNoon, 1, DUSK_ALTITUDE);
	// No dusk: in polar night the sky is dark by the evening anyway; under the midnight sun it never is.
	const evening = dusk
		? new Date(dusk.date.getTime() + DAY_MS / 24)
		: new Date(fromNoon.getTime() + DAY_MS / 4);
	if (altitude(Body.Sun, evening, observer) > DUSK_ALTITUDE) return [];
	return planets
		.map(([id, body]) => ({
			id,
			up: altitude(body, evening, observer),
			mag: Illumination(body, evening).mag
		}))
		.filter((p) => p.up >= PLANET_ALTITUDE && p.mag <= PLANET_MAGNITUDE)
		.sort((a, b) => a.mag - b.mag)
		.map((p) => p.id);
}
