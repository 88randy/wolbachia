import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { CameraRef, MapRef } from '@maplibre/maplibre-react-native';
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
import { Button, KeyValue, LogView, Note, Screen, Section, colors, errorMessage, formatBytes, formatMs, useLog } from '../ui';

type LoadedFile = { path: string; bytes: number; header: PmtilesHeader };
type FeatureCount = { summary: string; total: number };

/** No features within this time after loading: logged as a timeout (same limit as the pack mode). */
const RENDER_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const FIT_PADDING = 24;

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

/** Counts the features currently rendered for each style layer (queryRenderedFeatures, whole viewport). */
async function countRenderedFeatures(map: MapRef): Promise<FeatureCount> {
  const counts: string[] = [];
  let total = 0;
  for (const layer of PMTILES_LAYER_IDS) {
    const features = await map.queryRenderedFeatures({ layers: [layer] });
    total += features.length;
    counts.push(`${layer}=${features.length}`);
  }
  return { summary: `${counts.join(', ')} (total ${total})`, total };
}

/**
 * "Local PMTiles" mode. It never touches OfflineManager: PMTiles sources do not support offline packs or
 * the ambient cache (MapLibre Native Android docs, "PMTiles", Limitations); the file itself is the offline data.
 *
 * Measuring: on the S24 Ultra onDidFinishRenderingMapFully never fired although tiles were drawn, so it is not
 * used. Instead the rendered features are counted every 500 ms after the map mounts and the first count above
 * zero is reported as "time to first features". Zero until the timeout is shown as a warning.
 *
 * Gestures: the map has two layouts. Embedded (inside the screen's ScrollView, which competes for touches) and
 * full screen (no scroll container around it), where pinch, pan and rotate get every gesture.
 */
export function PmtilesMap() {
  const logger = useLog();
  const { log } = logger;
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [firstFeatures, setFirstFeatures] = useState('-');
  const [featureSummary, setFeatureSummary] = useState('-');
  const loadStartedAt = useRef<number>(performance.now());
  const firstFrameLogged = useRef(false);
  const fitted = useRef(false);

  const style = useMemo(() => (loaded === null ? null : buildPmtilesStyle(loaded.path)), [loaded]);

  /** Restarts the clock and mounts a fresh map. Every measurement is relative to this moment. */
  const remountMap = useCallback(() => {
    loadStartedAt.current = performance.now();
    firstFrameLogged.current = false;
    fitted.current = false;
    setFirstFeatures('-');
    setFeatureSummary('-');
    setMapKey((key) => key + 1);
  }, []);

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
      remountMap();
    } catch (error) {
      setLoaded(null);
      log(`ERROR ${errorMessage(error)}`);
    }
  };

  const toggleFullScreen = () => {
    setFullScreen((value) => !value);
    remountMap();
  };

  // Poll the feature count until the first one shows up, or the timeout.
  useEffect(() => {
    if (loaded === null) return undefined;
    let cancelled = false;
    let busy = false;
    const timer = setInterval(() => {
      if (busy || mapRef.current === null) return;
      busy = true;
      countRenderedFeatures(mapRef.current)
        .then((count) => {
          if (cancelled) return;
          const sinceStart = performance.now() - loadStartedAt.current;
          if (count.total > 0) {
            clearInterval(timer);
            setFirstFeatures(formatMs(sinceStart));
            setFeatureSummary(count.summary);
            log(`first features after ${formatMs(sinceStart)}: ${count.summary}`);
          } else if (sinceStart > RENDER_TIMEOUT_MS) {
            clearInterval(timer);
            setFeatureSummary(count.summary);
            log(`ERROR no features within ${RENDER_TIMEOUT_MS / 1000} s (render timeout)`);
            log('WARNING: no features rendered (wrong file, schema or source)');
          }
        })
        // The map may not be ready to be queried yet: keep polling, report only the timeout.
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loaded, log, mapKey]);

  const fitToFile = useCallback(
    (source: string) => {
      if (loaded === null || fitted.current) return;
      try {
        cameraRef.current?.fitBounds(loaded.header.bounds, {
          padding: { top: FIT_PADDING, right: FIT_PADDING, bottom: FIT_PADDING, left: FIT_PADDING },
          duration: 0,
        });
        fitted.current = true;
        log(`camera fitted to file bounds (after ${source})`);
      } catch (error) {
        log(`ERROR fitting camera to bounds: ${errorMessage(error)}`);
      }
    },
    [loaded, log]
  );

  const onDidFinishLoadingStyle = useCallback(() => {
    log(`map: style loaded after ${formatMs(performance.now() - loadStartedAt.current)}`);
    fitToFile('style load');
  }, [fitToFile, log]);

  const onDidFinishLoadingMap = useCallback(() => {
    log(`map: loading finished after ${formatMs(performance.now() - loadStartedAt.current)}`);
    fitToFile('map load');
  }, [fitToFile, log]);

  const onDidFinishRenderingFrame = useCallback(() => {
    if (firstFrameLogged.current) return;
    firstFrameLogged.current = true;
    log(`map: first frame after ${formatMs(performance.now() - loadStartedAt.current)}`);
  }, [log]);

  const onDidFailLoadingMap = useCallback(() => {
    log('ERROR map failed to load (style or PMTiles source could not be read)');
  }, [log]);

  const mapView =
    loaded !== null && style !== null ? (
      <Map
        ref={mapRef}
        key={mapKey}
        style={StyleSheet.absoluteFill}
        mapStyle={style}
        onDidFinishLoadingStyle={onDidFinishLoadingStyle}
        onDidFinishLoadingMap={onDidFinishLoadingMap}
        onDidFinishRenderingFrame={onDidFinishRenderingFrame}
        onDidFailLoadingMap={onDidFailLoadingMap}
      >
        <Camera ref={cameraRef} initialViewState={{ bounds: loaded.header.bounds }} />
      </Map>
    ) : null;

  if (fullScreen) {
    return (
      <View style={styles.full}>
        {mapView}
        <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
        <View style={styles.fullBar}>
          <Button label="Close full screen" onPress={toggleFullScreen} />
          <Text style={styles.fullStatus}>First features: {firstFeatures}</Text>
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <Section title="Local PMTiles (no network, no offline pack)">
        <Note>
          Copy the file with adb (README, "Local PMTiles"), then press "Load file". The style has no glyphs and no
          sprite: roads, water polygons, land use and buildings only. No labels, and river and stream lines are not
          drawn (only water polygons). Turn on airplane mode to prove it works offline. Pinch and pan work badly
          inside this scrolling screen: use "Full screen map" for gestures.
        </Note>
        <KeyValue label="Expected file" value={`${PMTILES_DIR_NAME}/${PMTILES_FILE_NAME}`} />
        <Button label="Load file" onPress={load} />
        <KeyValue label="File size" value={loaded === null ? '-' : formatBytes(loaded.bytes)} />
        <KeyValue label="Zoom range in file" value={loaded === null ? '-' : `${loaded.header.minZoom} to ${loaded.header.maxZoom}`} />
        <KeyValue label="Time to first features" value={firstFeatures} />
        <KeyValue label="Features rendered" value={featureSummary} />
        {featureSummary.endsWith('(total 0)') ? (
          <Text style={styles.warn}>WARNING: no features rendered (wrong file, schema or source)</Text>
        ) : null}
        {mapView !== null ? (
          <>
            <View style={styles.map}>
              {mapView}
              <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
            </View>
            <Button label="Full screen map (pinch, pan, rotate)" onPress={toggleFullScreen} />
            <Button label="Reload map (re-time render)" onPress={remountMap} />
          </>
        ) : null}
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
  full: { flex: 1, backgroundColor: '#e8e8e8' },
  fullBar: { position: 'absolute', top: 8, left: 8, right: 8, gap: 4 },
  fullStatus: { backgroundColor: 'rgba(255,255,255,0.85)', color: colors.fg, padding: 4, fontSize: 12 },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    fontSize: 10,
  },
});
