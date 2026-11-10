# Design

Visual direction "Aurora answers", chosen on 2026-11-10 from six prototypes (branch `prototype/visual-direction`, variant G). Tokens live in `src/routes/layout.css`.

## Principles

- **Every tile answers a question.** A tile opens with a small question line ("Do I need an umbrella?") and answers it in one large line ("Yes, from 13:00 to 17:00."). Supporting data (a chart, a list) sits below the answer, never instead of it.
- **Answer first, detail on demand.** On a phone the first screen shows now, the one-sentence summary and the umbrella answer. Everything else is one scroll or one tap away.
- **The sky is the background.** Tiles are frosted glass over a gradient that matches the sky at the viewed place and hour. Dusk is the default until the living sky (U-01) exists.
- **One surface.** The `glass` tile is the only container style. No nested cards with their own shadows; inner rows use `bg-white/5` and a faint ring.

## Tokens

| Token               | Value                                                            | Use                                                            |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `font-sans`         | Plus Jakarta Sans Variable (self-hosted, `@fontsource-variable`) | All text; no second family                                     |
| `ink`               | white                                                            | Primary text, numbers, answers                                 |
| `ink-muted`         | white at 80%                                                     | Question lines, secondary text. Never lower than this on glass |
| `sun`, `sun-soft`   | amber 300 and 200                                                | Sun icons, warmth, highlights                                  |
| `rain`, `rain-soft` | sky 300 and 200                                                  | Rain icons, rain bars, precipitation chance                    |
| `good`              | emerald 300                                                      | Confidence ring, good scores                                   |
| `warm`, `cold`      | amber and sky                                                    | Ends of temperature range bars                                 |
| `radius-tile`       | 1.5rem                                                           | Tiles; inner rows use 1rem                                     |
| `--sky-dusk`        | layered radial gradients over indigo                             | Page background                                                |

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

- Phone: one column, 16 px side padding, tiles stacked in this order: now and summary, umbrella, when to go out, next hours, the week, confidence, compared to normal, stars, darkness.
- Desktop (`md` and up): a 4-column bento grid with `grid-flow-dense` so tiles of different spans leave no gaps. Now and summary take 2 by 2; umbrella and best times sit beside it; next hours spans the full width; the week takes 2 by 2 beside the four small answer tiles.
- Grid children get `min-w-0`, so horizontal lists (the hourly strip) scroll inside their tile instead of widening the page.

## Icons

Lucide (`@lucide/svelte`), stroke icons only, imported by name. Weather states: `Sun`, `CloudSun`, `Cloud`, `CloudRain`, `CloudSnow`, `Moon`, `CloudMoon`. Activities: `Footprints` (run), `Bike`, `Dog`, `Camera` (golden hour), `Telescope` (stars), `Shirt` (laundry). Icons next to text are `aria-hidden`; icon-only buttons have an `aria-label`. No emoji.

## Accessibility

- Text on glass is white at 80% or more. Contrast is checked against the darkest and the lightest sky state once U-01 adds them (daytime blue and overcast grey are the risky ones).
- Touch targets are at least 44 by 44 px (`h-11`, `size-11`).
- Charts are `aria-hidden` and the answer line above them states the same fact in words.
- `backdrop-filter` and gradients are decoration only: without them (old browsers, forced colors) the text still reads on the base indigo.
- Motion (sky changes, scrubbing) is disabled under `prefers-reduced-motion`.
