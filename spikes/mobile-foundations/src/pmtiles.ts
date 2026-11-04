import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { MAP_ATTRIBUTION } from './config';

/** PMTiles v3 header is 127 bytes (https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md). */
export const PMTILES_HEADER_BYTES = 127;

const MAGIC = 'PMTiles';
const SUPPORTED_VERSION = 3;
const TILE_TYPE_MVT = 1;
const TILE_TYPE_MLT = 6;
const E7 = 10_000_000;

export type PmtilesHeader = {
  version: number;
  /** 1 = Mapbox Vector Tile. Other values (PNG, JPEG, WebP, AVIF) are raster and need a raster layer. */
  tileType: number;
  minZoom: number;
  maxZoom: number;
  /** [west, south, east, north] in degrees. */
  bounds: [number, number, number, number];
  centerZoom: number;
  /** [longitude, latitude] in degrees. */
  center: [number, number];
};

/**
 * Reads the fixed fields we need from the first 127 bytes of a .pmtiles file.
 * Layout and little-endian int32 x 1e7 positions (longitude first, then latitude) come from the spec above.
 * [ASSUMPTION] longitude-then-latitude order inside a Position follows spec section 3.4; the spec text is
 * ambiguous in one place, so the result is shown on screen to be checked against the real zone.
 */
export function parsePmtilesHeader(bytes: Uint8Array): PmtilesHeader {
  if (bytes.length < PMTILES_HEADER_BYTES) {
    throw new Error(`File too short for a PMTiles header: ${bytes.length} bytes`);
  }
  const magic = String.fromCharCode(...bytes.subarray(0, MAGIC.length));
  if (magic !== MAGIC) throw new Error('Not a PMTiles file (magic number mismatch)');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint8(7);
  if (version !== SUPPORTED_VERSION) throw new Error(`Unsupported PMTiles version ${version} (need 3)`);
  const e7 = (offset: number): number => view.getInt32(offset, true) / E7;
  return {
    version,
    tileType: view.getUint8(99),
    minZoom: view.getUint8(100),
    maxZoom: view.getUint8(101),
    bounds: [e7(102), e7(106), e7(110), e7(114)],
    centerZoom: view.getUint8(118),
    center: [e7(119), e7(123)],
  };
}

/**
 * Returns a warning when the tiles are not Mapbox Vector Tiles, or null when they are.
 * Tile type 6 is MLT (MapLibre Tile), a different vector encoding. [ASSUMPTION] this style and the native
 * MapLibre 13.6.1 read MVT only; MLT needs a newer native version and a re-export of the file as MVT.
 */
export function tileTypeWarning(header: PmtilesHeader): string | null {
  if (header.tileType === TILE_TYPE_MVT) return null;
  if (header.tileType === TILE_TYPE_MLT) {
    return 'WARNING: tile type 6 is MLT (MapLibre Tile), not MVT. This style expects MVT: export the file as MVT.';
  }
  return `WARNING: tile type ${header.tileType} is not MVT (vector): the vector style will show nothing`;
}

/** Layer ids of the style below, one per Protomaps source-layer. */
export const PMTILES_LAYER_IDS = ['earth', 'water', 'roads', 'landuse', 'buildings'] as const;

const ROAD_KINDS = ['highway', 'major_road', 'minor_road', 'path'];

const COLOR = {
  background: '#f2efe9',
  earth: '#efece4',
  park: '#cfe5c2',
  forest: '#b9d9a8',
  water: '#a8cfe8',
  building: '#d9d3c7',
  roadMinor: '#ffffff',
  roadMajor: '#f7d98b',
  roadHighway: '#f0a860',
  path: '#c9b9a0',
} as const;

/**
 * Minimal vector style over a local PMTiles file, written in code.
 *
 * Source URL form (MapLibre Native Android docs, "PMTiles"): `pmtiles://file://<absolute path>` for a local
 * file; the URL after `pmtiles://` must be complete because relative URLs are not resolved on Native.
 * https://maplibre.org/maplibre-native/android/examples/data/PMTiles/ (needs Android SDK 11.7.0 or newer;
 * @maplibre/maplibre-react-native 11.5.1 ships native 13.6.1).
 *
 * No `glyphs` and no `sprite`: nothing is fetched at render time, so it works fully offline. The price is
 * that there are no labels, icons or road shields.
 *
 * Source-layer names (earth, water, landuse, roads, buildings) and the `kind` property of landuse and
 * roads come from https://docs.protomaps.com/basemaps/layers (basemap v4). [ASSUMPTION] the owner's file
 * was built with that schema; the page says to verify the layer names in the tile itself.
 */
export function buildPmtilesStyle(filePath: string): StyleSpecification {
  const source = 'protomaps';
  return {
    version: 8,
    sources: {
      [source]: { type: 'vector', url: `pmtiles://file://${filePath}`, attribution: MAP_ATTRIBUTION },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLOR.background } },
      { id: 'earth', type: 'fill', source, 'source-layer': 'earth', paint: { 'fill-color': COLOR.earth } },
      {
        id: 'landuse',
        type: 'fill',
        source,
        'source-layer': 'landuse',
        paint: {
          'fill-color': [
            'match',
            ['get', 'kind'],
            ['park', 'garden', 'grass', 'meadow', 'recreation_ground', 'playground', 'pitch'],
            COLOR.park,
            ['forest', 'wood', 'scrub', 'nature_reserve', 'national_park'],
            COLOR.forest,
            'rgba(0,0,0,0)',
          ],
        },
      },
      { id: 'water', type: 'fill', source, 'source-layer': 'water', paint: { 'fill-color': COLOR.water } },
      {
        id: 'buildings',
        type: 'fill',
        source,
        'source-layer': 'buildings',
        minzoom: 13,
        paint: { 'fill-color': COLOR.building },
      },
      {
        id: 'roads',
        type: 'line',
        source,
        'source-layer': 'roads',
        // Only the road kinds we style: rail, ferry, aeroway, pier and aerialway lines are left out.
        filter: ['match', ['get', 'kind'], ROAD_KINDS, true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'match',
            ['get', 'kind'],
            'highway',
            COLOR.roadHighway,
            'major_road',
            COLOR.roadMajor,
            'path',
            COLOR.path,
            COLOR.roadMinor,
          ],
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            ['match', ['get', 'kind'], ['highway', 'major_road'], 1, 0.4],
            16,
            ['match', ['get', 'kind'], ['highway', 'major_road'], 8, 3],
          ],
        },
      },
    ],
  };
}
