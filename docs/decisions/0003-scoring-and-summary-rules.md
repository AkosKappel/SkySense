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
- **Ranges per activity:** running feels best from 6 to 18 °C, cycling from 12 to 24 °C, walking from 8 to 24 °C, hiking from 8 to 22 °C, a picnic from 18 to 28 °C (feels like). Hiking and picnics need daylight; a picnic tolerates little rain or wind, as people sit still. Gusts count at 60% of their speed. Laundry needs no rain in the next four hours, 15 °C or more, and some wind.
- **Comfort profile:** "I get cold easily" moves the feels-like ranges 3 °C up, "I get warm easily" 3 °C down. Laundry's air temperature is not personal and stays.
- **Requirements, not preferences:** night for stargazing, a clear dawn or dusk (45 minutes either side of sunrise and sunset) for golden hour photos, daylight for laundry, and no suggestions from 23:00 to 06:00 for running, cycling and walking. Hours failing a requirement never explain a low score, so stargazing says "too cloudy", not "too light".
- **A window** is the best stretch of the activity's usual length (an hour for a run, two for a ride, four for laundry) in which every hour scores at least 60; from 80 it is shown as great, unless a factor averages below 0.5 (shown as poor), so a cold run is never great. The earliest wins a tie. "Best in the next 10 days" is the highest-scoring window of any single day in the forecast.

- **Confidence** (`confidence.ts`) comes from 51 runs of the ECMWF ensemble (`ecmwf_ifs025_ensemble`, one model everywhere so places compare), reduced on the server to the 10th and 90th percentile of temperature and the share of runs with at least 0.1 mm per hour. A day is sure when the range averages under 3 °C and the runs are not split on rain (split = min(share, 100 - share) / 50, under 0.6); less sure under 6 °C and 0.8; uncertain beyond. The split threshold keeps tropical showers, which no model times, from marking every Singapore day uncertain.
- **Hedging:** the summary adds "The timing is uncertain." when fewer than half the runs show rain in the hour it is said to start, and "Some model runs do show rain or snow, though." when a dry day has an hour where 40% of runs are wet.
- **The band is the ensemble, the line is not:** the main forecast uses Open-Meteo's best model for the place, the band ECMWF's ensemble. The line can leave the band; that is a real disagreement between models, not a bug.

- **Compared to normal:** today's forecast high against the median high of every day within a week of the date in 1991 to 2020 (ERA5). From 1.5 °C off it is "warmer" or "colder"; beyond the 10th or 90th percentile the tile also says what share of those days it beats. History comes from one archive request per place and month (`/api/climate?month=`), cached 30 days on the CDN, as 30 years of daily data weighs like a few hundred forecast calls against Open-Meteo's limits.
- **Air and pollen** are shown only when notable: the European Air Quality Index from "moderate" (40) on, pollen from 10 grains per m³ (moderate) and 50 (high). The pollen bands are a rough common scale for every plant; real thresholds differ by species, so tune them when pollen season gives data. Poor air counts against running and cycling (a factor that falls from index 40 to 100), not walking.
- **The moon** is the mean synodic month from a known new moon (no astronomy library, D-10); it is off by up to half a day, enough for a phase name and brightness. Moonlight lowers stargazing (a full moon caps it at "good").

- **What to wear** follows the coldest feels-like of the next 12 waking hours, minus the comfort shift: a T-shirt from 24 °C, a light layer added from 17, a light jacket from 10, a warm jacket from 3, a winter coat from -5, full winter layers below. It adds something waterproof when rain is likely, windproof from gusts of 60 km/h and sun protection from UV 6.

- **Comparing two places** rates each day by its best one-hour walking window (the most general activity); a place is nicer that day when it scores at least 10 points higher, otherwise the day is a draw.

## Consequences

- The rules are easy to explain in the UI (S-06) and to test: each threshold has a test with synthetic hours, and the recorded fixtures catch surprises (polar night, heat, snow).
- They are opinions. The comfort profile shifts the temperature ranges; the rest change here first.
- Each window can show its factors as bars with a word (ideal, okay, poor), so a score is never a black box.
- No humidity per hour yet, so laundry ignores it; adding the field to the hourly request would let it count.
