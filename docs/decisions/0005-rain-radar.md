# 0005: Rain radar

_Status: Accepted · Date: 2026-11-11_

## Context

A radar map answers "is the rain coming my way?" better than any number. It needs radar images, a base map under them and a map library, and all three come from outside the app.

## Options

- **Radar:** RainViewer's free Weather Maps API (the past 2 hours, every 10 minutes; since 2026-01-01 no forecast frames and zoom 7 at most); EUMETNET OPERA open radar data (volume files, so we would render tiles ourselves); DWD's map service (Germany only).
- **The next hours:** RainViewer no longer has them. Open-Meteo answers a 5 × 5 grid of points in one request, the model's rain per hour.
- **Map library:** Leaflet 1.9 (44 KB gzip with its CSS) or MapLibre GL 6 (about 440 KB with its worker). Radar tiles are raster, which Leaflet handles.
- **Base map:** CARTO raster tiles (free key, 5 million requests a month for non-commercial use), OpenFreeMap (vector only, so MapLibre), OpenStreetMap's own servers (no app traffic allowed).
- **Privacy:** fetch the images in the browser, or pass them through our server.

## Decision

RainViewer for the past, an Open-Meteo grid for the next 3 hours, labelled as the model's, on Leaflet with CARTO's dark raster style. `?radar` on a place page; Leaflet and its CSS load only there. The frame list and the grid come through our `/api/` routes like all data; the images load in the browser straight from RainViewer and CARTO, which the Privacy page says. The CSP allows images from those two hosts.

The CARTO key is the public `CARTO_BASEMAP_KEY` variable: it ends up in tile URLs, so it is restricted to the site's hosts in the CARTO dashboard. Without it the radar shows on a plain dark background with the place marked.

## Consequences

- Zoom 7 is about 1.2 km per pixel: a regional view. The map can zoom in, stretching the radar.
- Radar and model can disagree (radar shows rain the model does not); the view shows both and says which is which.
- The grid is one request per place, counted as 25 forecast calls, cached for 10 minutes in memory and 15 on the CDN.
- Owner steps: request a CARTO key (one for the site's hosts, one for localhost), set `CARTO_BASEMAP_KEY` in Vercel. Tests never load tiles: Playwright answers them with a blank image.
