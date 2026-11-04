import { Camera, Map, OfflineManager } from '@maplibre/maplibre-react-native';
import type { OfflinePack, OfflinePackStatus, StyleSpecification } from '@maplibre/maplibre-react-native';
import { File, Paths } from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  DEFAULT_MAP_STYLE_URL,
  MAP_ATTRIBUTION,
  MAP_PACK_BOUNDS,
  MAP_PACK_MAX_ZOOM,
  MAP_PACK_MIN_ZOOM,
  MAP_TILE_COUNT_LIMIT,
} from '../config';
import { Button, KeyValue, LogView, Note, Screen, Section, colors, errorMessage, formatBytes, formatMs, useLog } from '../ui';

function buildRasterStyle(tileTemplate: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: [tileTemplate], tileSize: 256, attribution: MAP_ATTRIBUTION },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

/**
 * Returns the style location used by both the map and the offline pack.
 * Blank template: the MapLibre demo style URL. Otherwise a raster style is written to a local file.
 * [ASSUMPTION] MapLibre Native accepts a file:// style URL for offline packs. If the pack fails
 * with a style error, host the style JSON on your tile server and use its https URL instead.
 */
function resolveStyleUrl(tileTemplate: string): string {
  const trimmed = tileTemplate.trim();
  if (trimmed === '') return DEFAULT_MAP_STYLE_URL;
  const file = new File(Paths.document, 'spike-raster-style.json');
  if (!file.exists) file.create();
  file.write(JSON.stringify(buildRasterStyle(trimmed)));
  return file.uri;
}

export function MapScreen() {
  const logger = useLog();
  const { log } = logger;
  const [tileTemplate, setTileTemplate] = useState('');
  const [styleUrl, setStyleUrl] = useState(DEFAULT_MAP_STYLE_URL);
  const [mapKey, setMapKey] = useState(0);
  const [status, setStatus] = useState<OfflinePackStatus | null>(null);
  const [lastRender, setLastRender] = useState('-');
  const loadStartedAt = useRef<number | null>(null);
  const packStartedAt = useRef<number | null>(null);

  const applyStyle = () => {
    try {
      const url = resolveStyleUrl(tileTemplate);
      setStyleUrl(url);
      setMapKey((key) => key + 1);
      log(`style set: ${url}`);
    } catch (error) {
      log(`ERROR preparing style: ${errorMessage(error)}`);
    }
  };

  const downloadPack = async () => {
    try {
      // Fail early rather than silently fetching thousands of tiles.
      OfflineManager.setTileCountLimit(MAP_TILE_COUNT_LIMIT);
      // Disable the ambient cache so that an offline render can only come from the pack.
      await OfflineManager.setMaximumAmbientCacheSize(0);
      packStartedAt.current = performance.now();
      const pack: OfflinePack = await OfflineManager.createPack(
        {
          mapStyle: styleUrl,
          bounds: MAP_PACK_BOUNDS,
          minZoom: MAP_PACK_MIN_ZOOM,
          maxZoom: MAP_PACK_MAX_ZOOM,
          metadata: { name: 'spike-quadrant' },
        },
        (_pack, next) => {
          setStatus(next);
          if (next.state === 'complete' && packStartedAt.current !== null) {
            log(
              `pack complete in ${formatMs(performance.now() - packStartedAt.current)}: ` +
                `${next.completedTileCount} tiles, tiles ${formatBytes(next.completedTileSize)}, ` +
                `all resources ${formatBytes(next.completedResourceSize)}`
            );
            packStartedAt.current = null;
          }
        },
        (_pack, error) => {
          log(`ERROR pack ${error.id}: ${error.message}`);
        }
      );
      log(`pack created: ${pack.id}`);
    } catch (error) {
      log(`ERROR creating pack: ${errorMessage(error)}`);
    }
  };

  const listPacks = async () => {
    try {
      const packs = await OfflineManager.getPacks();
      log(`${packs.length} pack(s) stored`);
      for (const pack of packs) {
        const packStatus = await pack.status();
        log(
          `pack ${pack.id.slice(0, 8)}: ${packStatus.state}, ${packStatus.percentage.toFixed(0)}%, ` +
            `${packStatus.completedTileCount} tiles, ${formatBytes(packStatus.completedResourceSize)}`
        );
      }
    } catch (error) {
      log(`ERROR listing packs: ${errorMessage(error)}`);
    }
  };

  const deleteAllPacks = async () => {
    try {
      const packs = await OfflineManager.getPacks();
      for (const pack of packs) await OfflineManager.deletePack(pack.id);
      log(`deleted ${packs.length} pack(s)`);
      setStatus(null);
    } catch (error) {
      log(`ERROR deleting packs: ${errorMessage(error)}`);
    }
  };

  const onWillStartLoadingMap = useCallback(() => {
    loadStartedAt.current = performance.now();
  }, []);

  const onDidFinishRenderingMapFully = useCallback(() => {
    if (loadStartedAt.current === null) return;
    const elapsed = formatMs(performance.now() - loadStartedAt.current);
    loadStartedAt.current = null;
    setLastRender(elapsed);
    log(`map fully rendered in ${elapsed}`);
  }, [log]);

  const onDidFailLoadingMap = useCallback(() => {
    log('ERROR map failed to load (no network and no pack for this view?)');
  }, [log]);

  return (
    <Screen>
      <Section title="Offline map (MapLibre)">
        <Note>
          1) Online: Download pack. 2) Wait for "complete". 3) Turn on airplane mode, force-stop the app, reopen, press
          "Reload map" and film that the area still renders. The OSM tile server forbids offline use, so the default
          source is the MapLibre demo style (mechanics only). For real numbers enter your own tile URL.
        </Note>
        <Text style={styles.label}>Raster tile URL template (blank = demo style)</Text>
        <TextInput
          style={styles.input}
          value={tileTemplate}
          onChangeText={setTileTemplate}
          placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button label="Apply style" onPress={applyStyle} />
        <KeyValue label="Style" value={styleUrl} />
        <View style={styles.map}>
          <Map
            key={mapKey}
            style={StyleSheet.absoluteFill}
            mapStyle={styleUrl}
            onWillStartLoadingMap={onWillStartLoadingMap}
            onDidFinishRenderingMapFully={onDidFinishRenderingMapFully}
            onDidFailLoadingMap={onDidFailLoadingMap}
          >
            <Camera initialViewState={{ bounds: MAP_PACK_BOUNDS }} />
          </Map>
          <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
        </View>
        <Button label="Reload map (re-time render)" onPress={() => setMapKey((key) => key + 1)} />
        <KeyValue label="Last full render" value={lastRender} />
      </Section>
      <Section title="Offline pack">
        <KeyValue
          label="Area (W,S,E,N)"
          value={MAP_PACK_BOUNDS.map((value) => value.toString()).join(', ')}
        />
        <KeyValue label="Zoom" value={`${MAP_PACK_MIN_ZOOM} to ${MAP_PACK_MAX_ZOOM}`} />
        <KeyValue label="Tile cap" value={String(MAP_TILE_COUNT_LIMIT)} />
        <Button label="Download offline pack" onPress={() => void downloadPack()} />
        <Button label="Show stored packs" onPress={() => void listPacks()} />
        <Button label="Delete all packs" onPress={() => void deleteAllPacks()} danger />
        <KeyValue label="State" value={status === null ? '-' : status.state} />
        <KeyValue label="Progress" value={status === null ? '-' : `${status.percentage.toFixed(0)} %`} />
        <KeyValue label="Tiles" value={status === null ? '-' : String(status.completedTileCount)} />
        <KeyValue label="Size (all resources)" value={status === null ? '-' : formatBytes(status.completedResourceSize)} />
      </Section>
      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8 },
  map: { height: 300, borderRadius: 6, overflow: 'hidden', backgroundColor: '#e8e8e8' },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    fontSize: 10,
    color: colors.fg,
  },
});
