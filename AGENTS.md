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
- **No backend state:** no database, no accounts. Saved places and settings are in `localStorage`, wrapped so a private window or blocked storage never breaks the page.
- **Tests never hit the network:** unit tests and e2e use recorded responses (`src/lib/server/fixtures/`).

## Svelte

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`); runes mode is forced for project files in `vite.config.ts`. Shared reactive state goes in `.svelte.ts` modules.
- Imports from `src/lib` use the `#lib` alias (`#lib/units`), as `package.json` `imports` defines.
- Component tests are `*.svelte.test.ts` and run in Chromium with `vitest-browser-svelte`; plain unit tests are `*.test.ts` in node.
- E2E tests are `*.e2e.ts`.

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

## Data source

- Open-Meteo is free for non-commercial use, CC BY 4.0: the attribution link stays visible on every page that shows its data (footer) and in the README.
- Check the Open-Meteo docs for parameter and model names before adding a request; they are added and renamed over time.
