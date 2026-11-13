import type { Map as LeafletMap } from 'leaflet';
import { CARTO_BASEMAP_KEY } from '$app/env/public';

/** CARTO's dark basemap under a map's own layers; without a key, the map's plain background. */
export function addBasemap(L: typeof import('leaflet'), map: LeafletMap) {
	map.attributionControl.setPrefix(false);
	if (!CARTO_BASEMAP_KEY) return;
	L.tileLayer(
		`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`,
		{
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd'
		}
	).addTo(map);
}
