# Design

Visual direction "Aurora answers", chosen on 2026-11-10 from six prototypes (branch `prototype/visual-direction`, variant G). Tokens live in `src/routes/layout.css`.

## Principles

- **Every tile answers a question.** A tile opens with a small question line ("Do I need an umbrella?") and answers it in one large line ("Yes, from 13:00 to 17:00."). Supporting data (a chart, a list) sits below the answer, never instead of it.
- **Answer first, detail on demand.** On a phone the first screen shows now, the one-sentence summary and the umbrella answer. Everything else is one scroll or one tap away.
- **The sky is the background.** Tiles are frosted glass over a gradient that matches the sky at the viewed place and hour (`src/lib/sky.ts`): clear or cloudy night, dawn, clear or cloudy day, dusk and storm, chosen from the forecast's sunrise, sunset and condition. Rain and snow fall over it. Pages without a place use dusk.
- **One surface.** The `glass` tile is the only container style. No nested cards with their own shadows; inner rows use `bg-veil/5` and a faint ring.

## Tokens

| Token               | Value                                                            | Use                                                            |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `font-sans`         | Plus Jakarta Sans Variable (self-hosted, `@fontsource-variable`) | All text; no second family                                     |
| `ink`               | white (slate 900 in the light theme)                             | Primary text, numbers, answers                                 |
| `ink-muted`         | white at 85%                                                     | Question lines, secondary text. Never lower than this on glass |
| `sun`, `sun-soft`   | amber 300 and 200                                                | Sun icons, warmth, highlights                                  |
| `rain`, `rain-soft` | sky 300 and 200                                                  | Rain icons, rain bars, precipitation chance                    |
| `good`              | emerald 300                                                      | Confidence ring, good scores                                   |
| `warm`, `cold`      | amber and sky                                                    | Ends of temperature range bars                                 |
| `radius-tile`       | 1.5rem                                                           | Tiles; inner rows use 1rem                                     |
| `--sky-dusk`        | amber glow over indigo, the `dusk` sky                           | Page background without a place                                |

Utilities: `glass` (tile), `question` (the question line), `answer` (the answer line).

## Type scale

| Role                     | Size and weight                                      |
| ------------------------ | ---------------------------------------------------- |
| Current temperature      | `text-8xl` bold, `tabular-nums`                      |
| Summary headline (`h1`)  | `text-3xl`, `md:text-4xl`, extrabold, tight tracking |
| Tile answer              | `answer` (1.625rem, extrabold)                       |
| Body and supporting text | `text-sm` to `text-lg`, `ink-muted`                  |
| Labels (hours, days)     | `text-xs` to `text-sm`, medium                       |

Numbers that change or line up (temperatures, times, percentages) use `tabular-nums`.

## Layout

- Notices first, only when active: poor air or pollen, being offline, a full saved list.
- Phone: one column, 16 px side padding, in this order: the summary sentence (with "Share today as a picture"), now (with what to wear and the hour scrubber), the umbrella, when to go out, the next 24 hours, the temperature chart (with the model comparison link), darkness and wind, the 10 days (with confidence marks and "Compare with"), today in detail, compared to normal and past years.
- Tablet and small laptop (`md` to `xl`): a 2-column grid. The now tile spans both and lays itself out in two columns when it is that wide (a container query in `NowTile`); the next hours and the chart span both.
- Desktop (`xl`, 1280 px and up), revised 2026-11-12: two columns. On the left, pinned while the page scrolls (when the window is at least 56rem tall), the summary sentence set as the page's headline on the sky, the now tile and the air notice. On the right, the evidence: the umbrella beside the activities, the next hours and the chart across, then the remaining tiles in two balanced CSS columns (`columns-2`), because their heights differ too much for grid rows.
- Home page (2026-11-12): the tagline as the headline, then live answers for Bratislava, Madrid and Tromsø (streamed from the server, switched by the reader, the page's sky follows the chosen place) beside the place search and saved places, and below them the four questions the app answers. Returning visitors still go straight to their last place.
- Grid children get `min-w-0`, so horizontal lists (the hourly strip) scroll inside their tile instead of widening the page. Tables that would scroll sideways wrap instead (the place comparison), so no scroll region needs keyboard focus.
- Views one tap away, on the same page through a query: `?day=` a day (with its own activity times), `?models` the model comparison, `?year` the past year. `/compare` puts two saved places side by side; `/embed/...` is a small card for other sites; `/wall/...` is a full-screen clock and forecast for a tablet left on all day, dark and dimmed at night.
- Header: the place name opens the place sheet; previous and next saved place from 380 px (below that the name needs the room), Save, Share, Settings.

## Icons

Lucide (`@lucide/svelte`), stroke icons only, imported by name. Weather states: `Sun`, `CloudSun`, `Cloud`, `CloudRain`, `CloudSnow`, `Moon`, `CloudMoon`. Activities: `Footprints` (run), `Bike`, `Dog`, `Camera` (golden hour), `Telescope` (stars), `Shirt` (laundry). Icons next to text are `aria-hidden`; icon-only buttons have an `aria-label`. No emoji.

## Accessibility

- Text on glass is white at 85% or more, and every sky stays dark enough for it: `sky.test.ts` measures muted text under the glass against each sky's colours and glow (WCAG AA, 4.5:1). A new sky state needs to pass that test, which is why the day sky is a deep blue.
- Touch targets are at least 44 by 44 px (`h-11`, `size-11`).
- Charts are `aria-hidden` and the answer line above them states the same fact in words.
- `backdrop-filter` and gradients are decoration only: without them (old browsers, forced colors) the text still reads on the base indigo.
- Motion (falling rain and snow, scrubbing) is disabled under `prefers-reduced-motion`; the sky gradient stays.

## Light theme

Added 2026-11-12 (U-05). Settings offers _Like the system_, _Dark_ and _Light_ (cookie `skysense_theme`, default the system). Every colour token is `light-dark(light, dark)` and `<html data-theme>` sets `color-scheme`, so one set of classes serves both: glass and lines use `veil` (white on dark, slate on light) instead of `white`, opaque surfaces use `surface`, and text on a solid `veil` uses `on-veil`. Each sky in `src/lib/sky.ts` has a pale `light` palette, and `sky.test.ts` checks muted slate text and the light accents (the -800 shades of amber, sky, emerald and rose) on white glass at 62% over every light sky. The radar map stays dark in both themes (`.dark-scope`).
