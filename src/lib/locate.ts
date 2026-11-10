// The reader's position, for "Use my location" and the live "My location" entry (F-12).
import type { Coordinates } from '#lib/weather.js';

export type LocateError = 'denied' | 'unavailable';

/** Resolves with the position, or rejects with why not; a position up to 10 minutes old will do. */
export function locate(timeout = 10000): Promise<Coordinates> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject('unavailable' satisfies LocateError);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
			(error) =>
				reject(
					(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable') satisfies LocateError
				),
			{ timeout, maximumAge: 600000 }
		);
	});
}
