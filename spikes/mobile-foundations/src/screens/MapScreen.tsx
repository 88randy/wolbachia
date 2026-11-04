import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../ui';
import { OfflinePackMap } from './OfflinePackMap';
import { PmtilesMap } from './PmtilesMap';

type MapMode = 'pack' | 'pmtiles';

/**
 * Map tab: two modes that never run together. "Style + offline pack" uses OfflineManager; "Local PMTiles"
 * reads a file and does not use OfflineManager at all. Switching unmounts the other mode.
 */
export function MapScreen() {
  const [mode, setMode] = useState<MapMode>('pack');
  return (
    <View style={styles.flex}>
      <View style={styles.modes}>
        <View style={styles.flex}>
          <Button label="Style + offline pack" onPress={() => setMode('pack')} disabled={mode === 'pack'} />
        </View>
        <View style={styles.flex}>
          <Button label="Local PMTiles" onPress={() => setMode('pmtiles')} disabled={mode === 'pmtiles'} />
        </View>
      </View>
      {mode === 'pack' ? <OfflinePackMap /> : <PmtilesMap />}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modes: { flexDirection: 'row', gap: 8, padding: 8 },
});
