import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { MapRef } from '@maplibre/maplibre-react-native';
import { File, FileMode } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import DeviceControl from '../../modules/device-control';
import { MAP_ATTRIBUTION, PMTILES_DIR_NAME, PMTILES_FILE_NAME } from '../config';
import {
  PMTILES_HEADER_BYTES,
  PMTILES_LAYER_IDS,
  buildPmtilesStyle,
  parsePmtilesHeader,
  tileTypeWarning,
} from '../pmtiles';
import type { PmtilesHeader } from '../pmtiles';
import { Button, KeyValue, LogView, Note, Screen, Section, errorMessage, formatBytes, formatMs, useLog } from '../ui';

type LoadedFile = { path: string; bytes: number; header: PmtilesHeader };

/** The map must finish rendering within this time or the screen logs a render timeout (same as the pack mode). */
const RENDER_TIMEOUT_MS = 20_000;

/**
 * Reads the size and the header of the .pmtiles file in the app's external files dir. That folder needs no
 * permission and can be filled with `adb push` (see README). No tiles are downloaded here.
 */
function inspectFile(): LoadedFile {
  const dir = DeviceControl.getExternalFilesDir();
  if (dir === null) throw new Error('External files dir is not available on this phone');
  const path = `${dir}/${PMTILES_DIR_NAME}/${PMTILES_FILE_NAME}`;
  const file = new File(`file://${path}`);
  if (!file.exists) throw new Error(`File not found: ${path}`);
  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = parsePmtilesHeader(handle.readBytesSync(PMTILES_HEADER_BYTES));
    return { path, bytes: file.size, header };
  } finally {
    handle.close();
  }
}

/**
 * "Local PMTiles" mode. It never touches OfflineManager: PMTiles sources do not support offline packs or
 * the ambient cache (MapLibre Native Android docs, "PMTiles", Limitations); the file itself is the offline data.
 *
 * onDidFinishRenderingMapFully also fires when the source could not be read or the layer names are wrong (the
 * background still renders), so "rendered" is not proof of data. After the render the features drawn per layer
 * are counted; zero in total is shown as a warning.
 */
export function PmtilesMap() {
  const logger = useLog();
  const { log } = logger;
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [firstRender, setFirstRender] = useState('-');
  const [featureSummary, setFeatureSummary] = useState('-');
  const loadStartedAt = useRef<number | null>(null);
  const firstFrameLogged = useRef(false);
  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const style = useMemo(() => (loaded === null ? null : buildPmtilesStyle(loaded.path)), [loaded]);

  const clearRenderTimer = useCallback(() => {
    if (renderTimer.current !== null) clearTimeout(renderTimer.current);
    renderTimer.current = null;
  }, []);

  useEffect(() => clearRenderTimer, [clearRenderTimer]);

  const load = () => {
    try {
      const result = inspectFile();
      const { header } = result;
      log(`file ${result.path}`);
      log(`size ${formatBytes(result.bytes)} (${result.bytes} bytes)`);
      log(
        `header: v${header.version}, tile type ${header.tileType}, zoom ${header.minZoom}-${header.maxZoom}, ` +
          `bounds ${header.bounds.map((value) => value.toFixed(4)).join(', ')}`
      );
      const warning = tileTypeWarning(header);
      if (warning !== null) log(warning);
      setLoaded(result);
      setFirstRender('-');
      setFeatureSummary('-');
      setMapKey((key) => key + 1);
    } catch (error) {
      setLoaded(null);
      log(`ERROR ${errorMessage(error)}`);
    }
  };

  const onWillStartLoadingMap = useCallback(() => {
    loadStartedAt.current = performance.now();
    firstFrameLogged.current = false;
    log('map: will start loading');
    clearRenderTimer();
    renderTimer.current = setTimeout(() => {
      log(`ERROR map did not finish rendering within ${RENDER_TIMEOUT_MS / 1000} s (render timeout)`);
    }, RENDER_TIMEOUT_MS);
  }, [clearRenderTimer, log]);

  const elapsed = (): string =>
    loadStartedAt.current === null ? 'n/a' : formatMs(performance.now() - loadStartedAt.current);

  const onDidFinishRenderingFrame = useCallback(() => {
    if (firstFrameLogged.current) return;
    firstFrameLogged.current = true;
    log(`map: first frame after ${elapsed()}`);
  }, [log]);

  /** Counts the features currently rendered for each style layer (queryRenderedFeatures, viewport). */
  const countRenderedFeatures = useCallback(async () => {
    const counts: string[] = [];
    let total = 0;
    for (const layer of PMTILES_LAYER_IDS) {
      try {
        const features = (await mapRef.current?.queryRenderedFeatures({ layers: [layer] })) ?? [];
        total += features.length;
        counts.push(`${layer}=${features.length}`);
      } catch (error) {
        counts.push(`${layer}=error(${errorMessage(error)})`);
      }
    }
    const summary = counts.join(', ');
    setFeatureSummary(`${summary} (total ${total})`);
    log(`rendered features: ${summary}; total ${total}`);
    if (total === 0) log('WARNING: no features rendered (wrong file, schema or source)');
  }, [log]);

  const onDidFinishRenderingMapFully = useCallback(() => {
    if (loadStartedAt.current === null) return;
    const time = elapsed();
    loadStartedAt.current = null;
    clearRenderTimer();
    setFirstRender(time);
    log(`map render finished in ${time} (this does not prove tiles were drawn, see feature counts)`);
    void countRenderedFeatures();
  }, [clearRenderTimer, countRenderedFeatures, log]);

  const onDidFailLoadingMap = useCallback(() => {
    clearRenderTimer();
    log('ERROR map failed to load (style or PMTiles source could not be read)');
  }, [clearRenderTimer, log]);

  return (
    <Screen>
      <Section title="Local PMTiles (no network, no offline pack)">
        <Note>
          Copy the file with adb (README, "Local PMTiles"), then press "Load file". The style has no glyphs and no
          sprite: roads, water polygons, land use and buildings only. No labels, and river and stream lines are not
          drawn (only water polygons). Turn on airplane mode to prove it works offline.
        </Note>
        <KeyValue label="Expected file" value={`${PMTILES_DIR_NAME}/${PMTILES_FILE_NAME}`} />
        <Button label="Load file" onPress={load} />
        <KeyValue label="File size" value={loaded === null ? '-' : formatBytes(loaded.bytes)} />
        <KeyValue label="Zoom range in file" value={loaded === null ? '-' : `${loaded.header.minZoom} to ${loaded.header.maxZoom}`} />
        <KeyValue label="Time to render finished" value={firstRender} />
        <KeyValue label="Features rendered" value={featureSummary} />
        {featureSummary.endsWith('(total 0)') ? (
          <Text style={styles.warn}>WARNING: no features rendered (wrong file, schema or source)</Text>
        ) : null}
        {loaded !== null && style !== null ? (
          <View style={styles.map}>
            <Map
              ref={mapRef}
              key={mapKey}
              style={StyleSheet.absoluteFill}
              mapStyle={style}
              onWillStartLoadingMap={onWillStartLoadingMap}
              onDidFinishRenderingFrame={onDidFinishRenderingFrame}
              onDidFinishRenderingMapFully={onDidFinishRenderingMapFully}
              onDidFailLoadingMap={onDidFailLoadingMap}
            >
              <Camera
                initialViewState={{ center: loaded.header.center, zoom: loaded.header.centerZoom }}
                maxBounds={loaded.header.bounds}
              />
            </Map>
            <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
          </View>
        ) : null}
        {loaded !== null ? <Button label="Reload map (re-time render)" onPress={() => setMapKey((key) => key + 1)} /> : null}
      </Section>
      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 360, borderRadius: 6, overflow: 'hidden', backgroundColor: '#e8e8e8' },
  warn: { color: '#b00020', fontWeight: '700' },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    fontSize: 10,
  },
});
