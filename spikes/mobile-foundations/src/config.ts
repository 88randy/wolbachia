/**
 * Spike constants. Edit here, rebuild, reinstall.
 * Nothing in this file is a production decision.
 */

/**
 * Speed lock threshold in km/h.
 * Rule-parameter default only: in the real app the value comes from the backend rules per
 * organization (docs/decisions.md: "the app shows rules, it does not decide them").
 */
export const SPEED_LOCK_THRESHOLD_KMH = 10;

/** Number of fake events written by the local store benchmark. */
export const STORE_EVENT_COUNT = 10_000;

/** Number of individual (one event per call) writes used to measure per-event latency. */
export const STORE_SINGLE_WRITE_COUNT = 200;

/** Maximum rows returned when reading the pending queue (one sync batch). */
export const STORE_PENDING_BATCH = 100;

/**
 * Offline map test area, as [west, south, east, north].
 * Default: rough box around Mexico, shallow zoom, so the default test is tiny.
 * Replace with one real operating quadrant when testing with the owner's tile source.
 */
export const MAP_PACK_BOUNDS: [number, number, number, number] = [-118, 14, -86, 33];
export const MAP_PACK_MIN_ZOOM = 0;
export const MAP_PACK_MAX_ZOOM = 5;

/** Safety cap on tiles one offline pack may store (MapLibre OfflineManager.setTileCountLimit). */
export const MAP_TILE_COUNT_LIMIT = 500;

/**
 * Default map style: MapLibre demo style. The MapLibre docs say it is for development only.
 * Do NOT point the offline pack at tile.openstreetmap.org: the OSM tile usage policy
 * (operations.osmfoundation.org/policies/tiles/) says offline use and pre-seeding are not
 * permitted on that server. Use your own tile server or a provider that allows offline use.
 */
export const DEFAULT_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

/** Attribution text always shown over the map. Change it to match the tile source. */
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors';

/** Organic Maps Android package id (F-Droid listing: f-droid.org/en/packages/app.organicmaps/). */
export const ORGANIC_MAPS_PACKAGE = 'app.organicmaps';

/** Fixed test destination for "How to get there": Zocalo, Mexico City (public landmark). */
export const GO_THERE_TARGET = { lat: 19.4326, lng: -99.1332, label: 'Test destination' };
