# 0002: Open-Meteo through a caching proxy

_Status: Accepted · Date: 2026-11-10_

## Context

The features need more than a forecast: ensemble members for confidence, decades of history for climate normals, air quality and pollen, and place search in five languages. The app has no accounts and no budget for a paid API.

## Options

- **Open-Meteo:** forecast, ensemble, historical (ERA5), air quality and geocoding from one provider, no API key, CC BY 4.0, free for non-commercial use up to 10,000 calls a day.
- **OpenWeatherMap, WeatherAPI, Tomorrow.io:** need keys, the free tiers have no ensembles or long history.
- **National services (DWD, SHMÚ, HungaroMet, AEMET):** good data but one integration per country.

## Decision

Open-Meteo for every data need, called only from the app's server routes:

- Coordinates are rounded to 2 decimals (about 1 km) before any request, so nearby users share cache entries and the exact location never leaves our server.
- Responses carry `Cache-Control: s-maxage` matched to how often the data changes: forecast 15 minutes, ensemble and air quality 1 hour, geocoding 1 day, climate normals 30 days.
- Ensemble members are reduced on the server to percentiles and rain agreement, so phones download a few kilobytes instead of every member.
- The long ERA5 record behind the history view (H-09, H-10) is the heaviest request: Open-Meteo counts every two weeks of days as a call, so 1961 to last year is about 1,700 calls of the 10,000 a day and 5,000 an hour, shared with every forecast. It starts in 1961 (the WMO's reference period for change) rather than 1940 (about 2,200 calls), is keyed by ERA5's 0.25° grid cell instead of the place, carries the normals too, is fetched only when the history view opens, and is cached for a year with its last year in the URL (decided 2026-11-22).

## Consequences

- Free use stays within the non-commercial terms; a commercial launch would need an Open-Meteo subscription.
- The attribution link is shown wherever its data appears.
- One provider is a single point of failure; the app shows the last cached forecast with its age when the API is down.
