// Records Open-Meteo responses into src/lib/server/fixtures for tests, e2e and demos (T-08, T-10).
// Each live forecast gets its ensemble (`ensemble-*`) for the same days.
// Run: node scripts/record-fixtures.ts [name ...]   (no names records all of them)
//
// Live forecasts are recorded as they are today. Past scenarios (polar night, midnight sun, a heat
// wave) come from the historical forecast API, which has no `current` block, so one is built from
// the hour given as `now`.
import { writeFileSync } from 'node:fs';

const hourly = [
	'temperature_2m',
	'apparent_temperature',
	'precipitation_probability',
	'precipitation',
	'weather_code',
	'wind_speed_10m',
	'wind_gusts_10m',
	'uv_index',
	'is_day'
];
const daily = [
	'weather_code',
	'temperature_2m_max',
	'temperature_2m_min',
	'precipitation_probability_max',
	'precipitation_sum',
	'sunrise',
	'sunset',
	'uv_index_max'
];
const current = [
	'temperature_2m',
	'apparent_temperature',
	'weather_code',
	'wind_speed_10m',
	'wind_gusts_10m',
	'wind_direction_10m',
	'relative_humidity_2m',
	'is_day'
];

type Fixture = { lat: number; lon: number; past?: { start: string; now: string } };

// `forecast-*` fixtures are picked by nearest coordinates in SKYSENSE_FIXTURES mode;
// `scenario-*` fixtures are only imported by tests and the demo mode.
const fixtures: Record<string, Fixture> = {
	'forecast-bratislava': { lat: 48.15, lon: 17.11 },
	'forecast-madrid': { lat: 40.42, lon: -3.7 },
	'forecast-tromso': { lat: 69.65, lon: 18.96 },
	'forecast-norilsk': { lat: 69.35, lon: 88.2 },
	'forecast-singapore': { lat: 1.29, lon: 103.85 },
	'scenario-polar-night': { lat: 69.65, lon: 18.96, past: { start: '2025-12-15', now: '12:00' } },
	'scenario-midnight-sun': { lat: 69.65, lon: 18.96, past: { start: '2026-06-18', now: '23:00' } },
	'scenario-heat': { lat: 40.42, lon: -3.7, past: { start: '2026-07-10', now: '15:00' } }
};

function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

async function record(name: string, { lat, lon, past }: Fixture) {
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: hourly.join(','),
		daily: daily.join(','),
		timezone: 'auto'
	});
	let url: string;
	if (past) {
		params.set('start_date', past.start);
		params.set('end_date', addDays(past.start, 9));
		params.set('hourly', [...hourly, 'wind_direction_10m', 'relative_humidity_2m'].join(','));
		url = `https://historical-forecast-api.open-meteo.com/v1/forecast?${params}`;
	} else {
		params.set('current', current.join(','));
		params.set('forecast_days', '10');
		url = `https://api.open-meteo.com/v1/forecast?${params}`;
	}

	const response = await fetch(url);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	const data = await response.json();

	if (past) {
		const time = `${past.start}T${past.now}`;
		const i = data.hourly.time.indexOf(time);
		if (i === -1) throw new Error(`${name}: no hour ${time}`);
		data.current = { time, interval: 900 };
		for (const key of current) data.current[key] = data.hourly[key][i];
		delete data.hourly.wind_direction_10m;
		delete data.hourly.relative_humidity_2m;
	}

	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(data) + '\n'
	);
	if (!past)
		await recordEnsemble(name.replace('forecast-', 'ensemble-'), lat, lon, data.hourly.time[0]);
	const codes = [...new Set(data.hourly.weather_code.slice(0, 48))].sort((a, b) => a - b);
	console.log(
		`${name}: now ${data.current.time}, codes ${codes.join(' ')}, sunrise ${data.daily.sunrise[0] || 'none'}, sunset ${data.daily.sunset[0] || 'none'}`
	);
}

// The ensemble for the same ten days, so the spread lines up with the recorded forecast (C-01).
async function recordEnsemble(name: string, lat: number, lon: number, firstHour: string) {
	const start = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,precipitation',
		models: 'ecmwf_ifs025_ensemble',
		timezone: 'auto',
		start_date: start,
		end_date: addDays(start, 9)
	});
	const response = await fetch(`https://ensemble-api.open-meteo.com/v1/ensemble?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

const wanted = process.argv.slice(2);
for (const [name, fixture] of Object.entries(fixtures)) {
	if (wanted.length === 0 || wanted.includes(name)) await record(name, fixture);
}
