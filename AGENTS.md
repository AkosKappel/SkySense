# SkySense

A mobile-first weather app built around activity windows, forecast confidence and comparison with the climate normal. The workspace rules in `~/projects/AGENTS.md` apply; this file adds what is specific to SkySense. The plan, priorities and status live in `BACKLOG.md` (local, not tracked).

## Commands

pnpm only (`pnpm-lock.yaml`).

| Command         | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `pnpm dev`      | Dev server on port 5173                                         |
| `pnpm lint`     | Prettier check and ESLint                                       |
| `pnpm format`   | Prettier write                                                  |
| `pnpm check`    | `pnpm i18n`, `svelte-kit sync`, then `svelte-check`             |
| `pnpm test`     | Vitest: `server` project (node) and `client` project (Chromium) |
| `pnpm test:e2e` | Playwright against `pnpm build && pnpm preview` (port 4173)     |
| `pnpm build`    | Production build with `adapter-vercel`                          |

Run `lint`, `check`, `test` and `build` before committing; CI runs the same plus `test:e2e`.

## Architecture

- **Data flow:** the browser calls only this app's `/api/` routes; `src/lib/server/` calls Open-Meteo. Never call Open-Meteo from client code: the server rounds coordinates to 2 decimals (privacy and cache hits) and sets `Cache-Control: s-maxage` so Vercel's CDN absorbs repeat requests.
- **Validate at the boundary:** Open-Meteo responses are parsed and validated once in `src/lib/server/`; the rest of the app works with typed hour and day records, not the API's column arrays.
- **Pure logic, outside components:** the summary, activity scoring, windows, confidence and normals are pure functions in `src/lib/` (no Svelte imports), unit tested with the recorded fixtures. Components only display their results.
- **No backend state:** no database, no accounts. Saved places are in `localStorage` (`src/lib/places.svelte.ts`), wrapped so a private window or blocked storage never breaks the page. Units are a cookie (`skysense_units`, read in `+layout.server.ts`) so the server renders the first paint in them; the last place opened is a cookie too (`skysense_last`), so `/` redirects to it (`/?choose` shows the picker).
- **Routes:** `/p/[coords]/[[name]]` is a place (`/p/48.15,17.11/Bratislava`, coordinates rounded to 2 decimals, the name URI-encoded into the segment). Its universal load fetches `/api/forecast` (with the ensemble spread and air quality merged in) and, for `?models` and `?year`, `/api/models` and `/api/year?month=`; `?radar` loads Leaflet on demand and fetches `/api/radar` and `/api/rain-grid` (its images come from RainViewer and CARTO, `docs/decisions/0005`); `/compare` loads two forecasts; `/embed/[coords]/[[name]]` is the one page other sites may frame; the browser fetches `/api/climate?month=` and `/api/recent?today=` itself; `/api/places` searches; `/api/reverse` names "My location" through OpenStreetMap's Nominatim (`docs/decisions/0006`). All API routes set `Cache-Control` for Vercel's CDN and keep upstream answers in a per-instance memory cache (`src/lib/server/memo.ts`, `docs/decisions/0004`).
- **Forecast model:** `src/lib/weather.ts` holds the `Forecast` types and pure helpers (`conditionOf` for WMO codes, `nextRain`, coordinate parsing). Times are the place's wall-clock time without an offset; `src/lib/time.ts` formats them by reading them as UTC, never with the reader's zone. Values are metric; `src/lib/units.ts` converts when formatting, through `formatter()` in `src/lib/format.ts`.
- **Tests never hit the network:** unit tests and e2e use recorded responses (`src/lib/server/fixtures/`). `SKYSENSE_FIXTURES=1` (declared in `src/env.ts`, read from `$app/env/private`) makes the server answer from them; Playwright sets it. Re-record them with `node scripts/record-fixtures.ts` when the fields change (the climate archive is heavy: a few requests a minute at most).
- **Demo scenarios:** with fixtures on, `?demo=heat`, `?demo=polar-night` or `?demo=midnight-sun` on a place page shows that recorded scenario, for reproducible screenshots (README, portfolio). Without fixtures the parameter is ignored.

## Svelte

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`); runes mode is forced for project files in `vite.config.ts`. Shared reactive state goes in `.svelte.ts` modules.
- Imports from `src/lib` use the `#lib` alias with the file extension (`#lib/units.js`, `#lib/places.svelte.js`, `#lib/components/Tile.svelte`), as `package.json` `imports` maps paths literally.
- Links and `goto` call `resolve()` inline (the `svelte/no-navigation-without-resolve` rule); route params are encoded by the caller (`encodeURIComponent(name)`), since `resolve` does not encode.
- Environment variables are declared in `src/env.ts` (`defineEnvVars`) and imported from `$app/env/private` or `$app/env/public`; SvelteKit 3 has no `$env/*` modules.
- Component tests are `*.svelte.test.ts` and run in Chromium with `vitest-browser-svelte`; plain unit tests are `*.test.ts` in node.
- E2E tests are `e2e/*.e2e.ts`: desktop Chrome and Pixel 7 against `pnpm build && pnpm preview` with fixtures, axe on every main page.
- Visually hidden text (`sr-only`) inside a scrolling container needs a positioned ancestor (`relative`) inside it, or it widens the page.

## Languages

- English (base), German, Slovak, Hungarian and Spanish with Paraglide (`project.inlang`, `messages/{locale}.json`). The locale comes from the `PARAGLIDE_LOCALE` cookie, then the browser's languages, then English; URLs carry none. `src/hooks.server.ts` renders each request in its locale and sets `lang` and `dir` on `<html>`.
- Every user-facing string is a message, called where it is shown (`m.key()`), never stored in a module-level constant: the server renders each request in its own language.
- Write whole sentences per language. Logic returns a message key plus parameters (`{ key: 'rainFrom', from: '14:00', hours: 2 }`), never translated fragments to glue together. Counts use plural forms (Slovak has one, few and other).
- Address the reader informally (du, tykanie, tegeződés, tú).
- Numbers, dates and times go through `Intl` with the current locale; units follow the user's setting, not the language.
- `src/lib/paraglide` is generated and not committed (`pnpm i18n` or the Vite plugin).

## Accessibility and design

- WCAG 2.2 AA. One `main` and one `h1` per page. Text contrast is checked against every sky state, not only the default.
- Charts always have a text equivalent; color is never the only signal.
- Anything animated respects `prefers-reduced-motion`.
- Colors and spacing are Tailwind tokens in `src/routes/layout.css`; no hard-coded hex values in components.
- The visual direction is "Aurora answers" (`docs/design.md`): frosted `glass` tiles over a sky gradient, each tile a `question` line plus an `answer` line, Plus Jakarta Sans (self-hosted), Lucide icons.

## Data source

- Open-Meteo is free for non-commercial use, CC BY 4.0: the attribution link stays visible on every page that shows its data (footer) and in the README.
- Check the Open-Meteo docs for parameter and model names before adding a request; they are added and renamed over time.
