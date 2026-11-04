import { Camera, Map } from '@maplibre/maplibre-react-native';
import { File, FileMode } from 'expo-file-system';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import DeviceControl from '../../modules/device-control';
import { MAP_ATTRIBUTION, PMTILES_DIR_NAME, PMTILES_FILE_NAME } from '../config';
import { PMTILES_HEADER_BYTES, buildPmtilesStyle, isVectorTiles, parsePmtilesHeader } from '../pmtiles';
import type { PmtilesHeader } from '../pmtiles';
import { Button, KeyValue, LogView, Note, Screen, Section, errorMessage, formatBytes, formatMs, useLog } from '../ui';

type LoadedFile = { path: string; bytes: number; header: PmtilesHeader };

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
 */
export function PmtilesMap() {
  const logger = useLog();
  const { log } = logger;
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [firstRender, setFirstRender] = useState('-');
  const loadStartedAt = useRef<number | null>(null);
  const firstFrameLogged = useRef(false);

  const style = useMemo(() => (loaded === null ? null : buildPmtilesStyle(loaded.path)), [loaded]);

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
      if (!isVectorTiles(header)) log('WARNING: tile type is not MVT (vector): the vector style will show nothing');
      setLoaded(result);
      setFirstRender('-');
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
  }, [log]);

  const elapsed = (): string =>
    loadStartedAt.current === null ? 'n/a' : formatMs(performance.now() - loadStartedAt.current);

  const onDidFinishRenderingFrame = useCallback(() => {
    if (firstFrameLogged.current) return;
    firstFrameLogged.current = true;
    log(`map: first frame after ${elapsed()}`);
  }, [log]);

  const onDidFinishRenderingMapFully = useCallback(() => {
    if (loadStartedAt.current === null) return;
    const time = elapsed();
    loadStartedAt.current = null;
    setFirstRender(time);
    log(`map fully rendered in ${time} (time to first full render)`);
  }, [log]);

  const onDidFailLoadingMap = useCallback(() => {
    log('ERROR map failed to load (style or PMTiles source could not be read)');
  }, [log]);

  return (
    <Screen>
      <Section title="Local PMTiles (no network, no offline pack)">
        <Note>
          Copy the file with adb (README, "Local PMTiles"), then press "Load file". The style has no glyphs and no
          sprite: roads, water, land use and buildings only, no labels. Turn on airplane mode to prove it.
        </Note>
        <KeyValue label="Expected file" value={`${PMTILES_DIR_NAME}/${PMTILES_FILE_NAME}`} />
        <Button label="Load file" onPress={load} />
        <KeyValue label="File size" value={loaded === null ? '-' : formatBytes(loaded.bytes)} />
        <KeyValue label="Zoom range in file" value={loaded === null ? '-' : `${loaded.header.minZoom} to ${loaded.header.maxZoom}`} />
        <KeyValue label="Time to first full render" value={firstRender} />
        {loaded !== null && style !== null ? (
          <View style={styles.map}>
            <Map
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
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 4,
    fontSize: 10,
  },
});
