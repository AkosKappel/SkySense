// The moon's phase (H-05) from the mean synodic month, without an astronomy library (D-10). The
// mean month drifts from the true one by up to about half a day, fine for a phase name and a
// brightness; moonrise and moonset would need the full orbit, so they are left out.

const SYNODIC_DAYS = 29.530588853;
/** A new moon: 6 January 2000, 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

export const phases = [
	'new',
	'waxingCrescent',
	'firstQuarter',
	'waxingGibbous',
	'full',
	'waningGibbous',
	'lastQuarter',
	'waningCrescent'
] as const;
export type Phase = (typeof phases)[number];

/**
 * The moon at a place-local wall-clock time ("2026-11-10T22:00"), read as UTC: the offset moves
 * the phase by at most a few percent of a day.
 */
export function moon(time: string): { phase: Phase; illumination: number; age: number } {
	const days = (Date.parse(`${time}Z`) - NEW_MOON) / DAY_MS;
	const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
	const illumination = (1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2;
	const phase = phases[Math.round((age / SYNODIC_DAYS) * 8) % 8];
	return { phase, illumination, age };
}
