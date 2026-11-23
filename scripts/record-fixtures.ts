// Records Open-Meteo responses into src/lib/server/fixtures for tests, e2e and demos (T-08, T-10).
// Each live forecast gets its ensemble (`ensemble-*`), model comparison (`models-*`), climate
// history (`climate-*`), air quality (`air-*`), daily history and the long record (`history-*`,
// `record-*`), the rain of the 60 days before (`recent-*`), the 30 days before as forecast a day
// ahead (`hindcast-*`) and a week either side for the garden (`garden-*`); public holidays
// (`holidays-*`) come from Nager.Date, waves and sea temperature (`marine-*`) from the Marine API.
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
	'is_day',
	'pressure_msl',
	'cloud_cover',
	'cloud_cover_low',
	'cloud_cover_mid',
	'snow_depth'
];
const daily = [
	'weather_code',
	'temperature_2m_max',
	'temperature_2m_min',
	'precipitation_probability_max',
	'precipitation_sum',
	'sunrise',
	'sunset',
	'uv_index_max',
	'snowfall_sum',
	'sunshine_duration'
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
	if (!past) {
		const first = data.hourly.time[0];
		await recordEnsemble(name.replace('forecast-', 'ensemble-'), lat, lon, first);
		await recordModels(name.replace('forecast-', 'models-'), lat, lon, first);
		await recordClimate(name.replace('forecast-', 'climate-'), lat, lon, first);
		await recordAir(name.replace('forecast-', 'air-'), lat, lon, first);
		await recordHistory(name.replace('forecast-', 'history-'), lat, lon, first);
		await recordRecord(name.replace('forecast-', 'record-'), lat, lon, first);
		await recordRecent(name.replace('forecast-', 'recent-'), lat, lon, first);
		await recordHindcast(name.replace('forecast-', 'hindcast-'), lat, lon, first);
		await recordGarden(name.replace('forecast-', 'garden-'), lat, lon, first);
	}
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

// Several models side by side for the comparison view (C-04), from the same first day.
async function recordModels(name: string, lat: number, lon: number, firstHour: string) {
	const start = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,precipitation',
		models: 'ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless,ukmo_seamless',
		timezone: 'auto',
		start_date: start,
		end_date: addDays(start, 3)
	});
	const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// ERA5 history for normals and "on this day" (H-01, H-02), trimmed to the weeks around the
// recorded date in every year: the full 30 years would be 300 KB per place.
async function recordClimate(name: string, lat: number, lon: number, firstHour: string) {
	const date = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		start_date: '1991-01-01',
		end_date: `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`,
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
		models: 'era5',
		timezone: 'auto'
	});
	const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	const data = await response.json();
	const dayOfYear = (d: string) =>
		(Date.UTC(2001, Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) - Date.UTC(2001, 0, 1)) /
		86_400_000;
	const keep = data.daily.time.map((t: string) => {
		const apart = Math.abs(dayOfYear(t) - dayOfYear(date));
		return Math.min(apart, 365 - apart) <= 25;
	});
	for (const key of Object.keys(data.daily)) {
		data.daily[key] = data.daily[key].filter((_: unknown, i: number) => keep[i]);
	}
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(data) + '\n'
	);
}

// Air quality and pollen (H-03) for the first five days, the API's range.
async function recordAir(name: string, lat: number, lon: number, firstHour: string) {
	const start = firstHour.slice(0, 10);
	const kinds = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: ['european_aqi', ...kinds.map((k) => `${k}_pollen`)].join(','),
		timezone: 'auto',
		start_date: start,
		end_date: addDays(start, 4)
	});
	const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// Daily ERA5 from the start of last year to six days before the recorded date, as far as ERA5
// reaches (H-09): every period the history view opens on, and a whole year to step back to.
async function recordHistory(name: string, lat: number, lon: number, firstHour: string) {
	const date = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		start_date: `${Number(date.slice(0, 4)) - 1}-01-01`,
		end_date: addDays(date, -6),
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max',
		models: 'era5',
		timezone: 'auto'
	});
	const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// The long record (H-09, H-10): ERA5 from 1961 to the end of the year before the recorded date,
// one day a week kept: every day would be 700 KB per place. Normals and yearly means come out
// about right from a weekly sample; counts of hot and frosty days are a seventh of the real ones.
async function recordRecord(name: string, lat: number, lon: number, firstHour: string) {
	const params = new URLSearchParams({
		latitude: String(Math.round(lat * 4) / 4),
		longitude: String(Math.round(lon * 4) / 4),
		start_date: '1961-01-01',
		end_date: `${Number(firstHour.slice(0, 4)) - 1}-12-31`,
		daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
		models: 'era5',
		timezone: 'auto'
	});
	let response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
	// One request weighs hundreds of calls; past the per-minute limit, wait a minute once.
	if (response.status === 429) {
		await new Promise((resolve) => setTimeout(resolve, 65_000));
		response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
	}
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	const data = await response.json();
	const keep = data.daily.time.map((_: string, i: number) => i % 7 === 0);
	for (const key of Object.keys(data.daily)) {
		data.daily[key] = data.daily[key].filter((_: unknown, i: number) => keep[i]);
	}
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(data) + '\n'
	);
}

// Rain, high and low on each of the 60 days before the recorded date (H-04, H-08).
async function recordRecent(name: string, lat: number, lon: number, firstHour: string) {
	const today = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		daily: 'precipitation_sum,temperature_2m_max,temperature_2m_min',
		timezone: 'auto',
		start_date: addDays(today, -60),
		end_date: addDays(today, -1)
	});
	const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// The 30 days before, forecast a day ahead and as they turned out (`hindcast-*`, X-14).
async function recordHindcast(name: string, lat: number, lon: number, firstHour: string) {
	const today = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'temperature_2m,temperature_2m_previous_day1,precipitation,precipitation_previous_day1',
		timezone: 'auto',
		start_date: addDays(today, -30),
		end_date: addDays(today, -1)
	});
	const response = await fetch(`https://previous-runs-api.open-meteo.com/v1/forecast?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// Rain, evaporation and the soil surface a week either side of the first day (`garden-*`, X-16).
async function recordGarden(name: string, lat: number, lon: number, firstHour: string) {
	const today = firstHour.slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		daily: 'precipitation_sum,et0_fao_evapotranspiration',
		hourly: 'soil_temperature_0cm',
		timezone: 'auto',
		start_date: addDays(today, -7),
		end_date: addDays(today, 6)
	});
	const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(`../src/lib/server/fixtures/${name}.json`, import.meta.url),
		JSON.stringify(await response.json()) + '\n'
	);
}

// The radar frames (M-01) and a 5 × 5 weather grid per place (rain, temperature, wind) are recorded separately: the frames'
// times are shifted to end at the forecast fixtures' "now" (2026-11-10 09:00 UTC) so the radar
// view's timeline joins up, and their tiles are never fetched in tests (Playwright answers them).

// The area grid (M-10): 7 × 7 points about 25 km apart, the forecast fixtures' day, the hourly
// variables the activity scores read. The same points as `areaPoints` in src/lib/better.ts.
async function recordArea(name: string, { lat, lon }: Fixture) {
	const steps = 3;
	const degrees = 0.225;
	const lonStep = degrees / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
	const points: { lat: number; lon: number }[] = [];
	for (let i = steps; i >= -steps; i--) {
		for (let j = -steps; j <= steps; j++) {
			points.push({
				lat: Math.round((lat + i * degrees) * 100) / 100,
				lon: Math.round((lon + j * lonStep) * 100) / 100
			});
		}
	}
	const params = new URLSearchParams({
		latitude: points.map((p) => p.lat).join(','),
		longitude: points.map((p) => p.lon).join(','),
		hourly: hourly.slice(0, hourly.indexOf('pressure_msl')).join(','),
		daily: daily.join(','),
		timezone: 'auto',
		start_date: '2026-11-10',
		end_date: '2026-11-10'
	});
	const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
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
// `history-*` or `record-*` alone, for the forecast fixture already recorded (its first hour).
for (const [name, { lat, lon }] of Object.entries(fixtures)) {
	if (!name.startsWith('forecast-')) continue;
	const history = name.replace('forecast-', 'history-');
	const record = name.replace('forecast-', 'record-');
	if (!wanted.includes(history) && !wanted.includes(record)) continue;
	const recorded = await import(`../src/lib/server/fixtures/${name}.json`, {
		with: { type: 'json' }
	});
	const first = recorded.default.hourly.time[0];
	if (wanted.includes(history)) await recordHistory(history, lat, lon, first);
	if (wanted.includes(record)) await recordRecord(record, lat, lon, first);
}
for (const [name, fixture] of Object.entries(fixtures)) {
	const area = name.replace('forecast-', 'area-');
	if (name.startsWith('forecast-') && (wanted.length === 0 || wanted.includes(area))) {
		await recordArea(area, fixture);
	}
}
// Public holidays from Nager.Date (F-26) for the forecast fixtures' countries, in the year they were
// recorded: `node scripts/record-fixtures.ts holidays`. A country Nager.Date lacks gets no file.
if (wanted.length === 0 || wanted.includes('holidays')) {
	for (const country of ['sk', 'es', 'no', 'ru', 'sg']) {
		const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/2026/${country}`);
		if (response.status !== 200) continue;
		writeFileSync(
			new URL(`../src/lib/server/fixtures/holidays-${country}-2026.json`, import.meta.url),
			JSON.stringify(await response.json()) + '\n'
		);
	}
}
// Waves and sea temperature (X-18) for the first two days of each live forecast:
// `node scripts/record-fixtures.ts marine`. Inland places come back as nulls, as they do live.
for (const [name, { lat, lon }] of Object.entries(fixtures)) {
	if (!name.startsWith('forecast-') || !(wanted.length === 0 || wanted.includes('marine')))
		continue;
	const recorded = await import(`../src/lib/server/fixtures/${name}.json`, {
		with: { type: 'json' }
	});
	const first = recorded.default.hourly.time[0].slice(0, 10);
	const params = new URLSearchParams({
		latitude: String(lat),
		longitude: String(lon),
		hourly: 'wave_height,sea_surface_temperature',
		timezone: 'auto',
		start_date: first,
		end_date: addDays(first, 1)
	});
	const response = await fetch(`https://marine-api.open-meteo.com/v1/marine?${params}`);
	if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
	writeFileSync(
		new URL(
			`../src/lib/server/fixtures/${name.replace('forecast-', 'marine-')}.json`,
			import.meta.url
		),
		JSON.stringify(await response.json()) + '\n'
	);
}
