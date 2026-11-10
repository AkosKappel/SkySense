# SkySense

The weather, made sense of. A weather app that answers the questions people actually ask, instead of showing another grid of icons:

- **When should I go?** Activity windows score every hour for running, cycling, walking, hiking, drying laundry, picnics, stargazing and golden hour photography, and name the best time of the day.
- **How sure is it?** Ensemble forecasts show how much the models agree, as bands around the temperature and as "80% of model runs show rain at 15:00".
- **Is this normal?** Today compared to the 1991 to 2020 climate for the same date and place.
- **In one sentence.** A plain-language summary on top: "Dry until 14:00, then about 2 hours of rain."

Mobile first, installable, private (no accounts, no tracking) and available in English, German, Slovak, Hungarian and Spanish.

> Status: in development. The plan and progress are tracked locally; this README describes the goal.

## Stack

SvelteKit with TypeScript, Tailwind CSS, Paraglide JS for translations, Vitest and Playwright, deployed on Vercel. Weather data from [Open-Meteo](https://open-meteo.com/), called through the app's own caching routes. Why these: [docs/decisions](docs/decisions/).

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev
```

| Command         | What it does                                               |
| --------------- | ---------------------------------------------------------- |
| `pnpm dev`      | Dev server on port 5173                                    |
| `pnpm lint`     | Prettier check and ESLint                                  |
| `pnpm format`   | Format everything with Prettier                            |
| `pnpm check`    | Compile translations, then `svelte-check` (types)          |
| `pnpm test`     | Unit and component tests (Vitest, Chromium for components) |
| `pnpm test:e2e` | Playwright against the production build                    |
| `pnpm build`    | Production build for Vercel                                |

## Data and attribution

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## License

[MIT](LICENSE)
