# 0003: Scoring and summary rules

_Status: Accepted · Date: 2026-11-10_

## Context

The umbrella answer, the summary sentence and the activity windows turn numbers into advice. Each needs thresholds, and thresholds scattered as constants in code read as magic. This record says what they are and why, so a change is a decision, not a tweak.

## Options

- **A model trained on user feedback:** needs accounts and data the app does not collect.
- **An LLM writing the summary:** costs money per request, can state things the data does not say, and is hard to test in five languages.
- **Explicit rules:** small pure functions with named thresholds, unit tested against recorded forecasts.

## Decision

Explicit rules, in pure functions under `src/lib/`:

- **Rain is likely from a 50% chance** (`RAIN_LIKELY`, `weather.ts`). Below it the umbrella answer says no; the tiles say where the line is.
- **Wind words follow the Beaufort scale** (`windLevel`, `format.ts`). Gusts from 60 km/h (`STRONG_GUST_KMH`, Beaufort 8) get a warning and lead the summary's second sentence.
- **The summary** (`summary.ts`) looks 24 hours ahead. The first sentence is about rain, snow or thunderstorms (sleet counts as rain); the second names one notable thing, in this order: strong gusts, first frost (only when it is above zero now), heat from 30 °C (only later today, so "around 12:00" never means tomorrow).
- **Activities** (`activities.ts`) score each hour from 0 to 100 as the weighted geometric mean of factors, each 1 inside an ideal range and falling linearly to 0 at the edge of an acceptable range. A geometric mean lets one bad factor (rain on laundry) sink the score instead of being averaged away.
- **Ranges per activity:** running feels best from 6 to 18 °C, cycling from 12 to 24 °C, walking from 8 to 24 °C (feels like). Gusts count at 60% of their speed. Laundry needs no rain in the next four hours, 15 °C or more, and some wind.
- **Requirements, not preferences:** night for stargazing, a clear dawn or dusk (45 minutes either side of sunrise and sunset) for golden hour photos, daylight for laundry, and no suggestions from 23:00 to 06:00 for running, cycling and walking. Hours failing a requirement never explain a low score, so stargazing says "too cloudy", not "too light".
- **A window** is the best stretch of the activity's usual length (an hour for a run, two for a ride, four for laundry) in which every hour scores at least 60; from 80 it is shown as great. The earliest wins a tie.

## Consequences

- The rules are easy to explain in the UI (S-06) and to test: each threshold has a test with synthetic hours, and the recorded fixtures catch surprises (polar night, heat, snow).
- They are opinions. A personal comfort profile (S-05) shifts the temperature ranges; the rest change here first.
- No humidity per hour yet, so laundry ignores it; adding the field to the hourly request would let it count.
