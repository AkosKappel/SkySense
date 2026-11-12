# 0006: Reverse geocoder

_Status: Accepted · Date: 2026-11-12_

## Context

"My location" (F-12) showed only that label, and a map tap (M-04) would need a name too. Open-Meteo's geocoding API searches by name only; naming a position needs another service.

## Options

- **OpenStreetMap Nominatim:** free, ODbL data, at most one request a second, the app must identify itself, and results should be cached. Attribution "© OpenStreetMap contributors".
- **BigDataCloud's free client API:** free with attribution, but only for calls from the browser with the device's own position, so the reader's IP would reach a third party and the server could not cache it.
- **No name:** keep "My location" alone.

## Decision

Nominatim, through our server like all data: `/api/reverse?lat=&lon=&lang=` rounds the coordinates to 2 decimals, asks for city level (`zoom=10`) in the reader's language and returns the city, town, village or municipality. The request carries a `User-Agent` naming the app and its URL; no personal contact address. Answers stay a day in memory and 30 days on the CDN, and an instance skips a second request within a second rather than queueing it.

## Consequences

- The reader's IP never reaches Nominatim; the Privacy page says the rounded coordinates do.
- The About page credits OpenStreetMap (ODbL).
- When the lookup fails, is busy or finds nothing (the open sea), the entry stays "My location".
- Fixtures `reverse-*` hold one recorded answer per test place.
- M-04 (forecast anywhere on the map) can use the same route.
