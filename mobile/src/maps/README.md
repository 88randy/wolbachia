# Offline map (`MapView`)

Embeddable map for the day map (P10) and the point/zone context in the ovitrap, release and
shift screens. Place it inside a plain flex `View` (never a scroll container).

```tsx
<MapView points={points} zones={zones} selectedId={id} onSelectPoint={setId} />
```

- `points`: `{ id, lat, lng, label, statusLabel, tone, icon }` (status is icon + text).
- `zones`: `{ id, label, ring: [lng, lat][], tone, patternIndex }` (color + dash pattern + label).
- The directions button ("Cómo llegar") opens the external maps app through a `geo:` URI and
  appears when `selectedId` matches a point. Hide it with `showDirections={false}`.
- The user location shows only when foreground location is already granted (no prompt here).

## Tiles and offline

- Stack: `@maplibre/maplibre-react-native` 11.5.1 (already a dependency, with its Expo plugin).
- Source: a Protomaps vector extract of Mérida (`backend/geography/map_data/merida.pmtiles`,
  about 4 MB, bbox -89.74,20.86,-89.52,21.08, zoom 0-15), (c) OpenStreetMap contributors (ODbL).
  Attribution is shown under the map.
- Our backend serves it at `GET /api/v1/map-tiles/merida.pmtiles` (public map data, no session).
  The app downloads it once into `Paths.document/maps/` and reads it with `pmtiles://file:///...`,
  so it works offline. No request ever goes to `tile.openstreetmap.org`.
- Regenerate or enlarge the extract with `pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles
merida.pmtiles --bbox=... --maxzoom=15` (go-pmtiles).
- No glyphs or sprites are bundled: road names and place labels are not drawn; the app draws
  point and zone labels itself.
