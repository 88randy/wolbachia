import * as Location from 'expo-location';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { SPEED_LOCK_THRESHOLD_KMH } from '../config';
import { Button, KeyValue, LogView, Note, Screen, Section, colors, errorMessage, formatMs, useLog } from '../ui';

const MS_TO_KMH = 3.6;

type Fix = {
  speedKmh: number | null;
  accuracyM: number | null;
  /** Age of the fix when our callback ran: Date.now() minus the fix timestamp. */
  fixAgeMs: number;
};

export function SpeedLockScreen() {
  const logger = useLog();
  const { log } = logger;
  const [permission, setPermission] = useState<string>('unknown');
  const [servicesOn, setServicesOn] = useState<string>('unknown');
  const [watching, setWatching] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locked, setLocked] = useState(false);
  const [renderLatency, setRenderLatency] = useState('-');
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const callbackAt = useRef<number | null>(null);
  const lockedRef = useRef(false);

  // Measures the time between our location callback and the overlay being laid out after the state change.
  useLayoutEffect(() => {
    if (callbackAt.current === null) return;
    const elapsed = performance.now() - callbackAt.current;
    callbackAt.current = null;
    setRenderLatency(formatMs(elapsed));
  }, [locked]);

  useEffect(() => {
    return () => {
      subscription.current?.remove();
      subscription.current = null;
    };
  }, []);

  const start = async () => {
    try {
      const granted = await Location.requestForegroundPermissionsAsync();
      setPermission(granted.status);
      if (granted.status !== Location.PermissionStatus.GRANTED) {
        log('location permission not granted');
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      setServicesOn(String(enabled));
      if (!enabled) log('WARNING: location services are OFF on the phone');

      subscription.current?.remove();
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (location) => {
          const received = performance.now();
          const rawSpeed = location.coords.speed;
          // expo-location reports speed in m/s. A negative value means "unknown" on some devices.
          const speedKmh = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed * MS_TO_KMH : null;
          const nextFix: Fix = {
            speedKmh,
            accuracyM: location.coords.accuracy,
            fixAgeMs: Date.now() - location.timestamp,
          };
          setFix(nextFix);
          const shouldLock = speedKmh !== null && speedKmh > SPEED_LOCK_THRESHOLD_KMH;
          if (lockedRef.current !== shouldLock) {
            lockedRef.current = shouldLock;
            callbackAt.current = received;
            log(
              `${shouldLock ? 'LOCK shown' : 'LOCK hidden'} at ${speedKmh === null ? 'n/a' : speedKmh.toFixed(1)} km/h, ` +
                `fix age ${nextFix.fixAgeMs} ms, accuracy ${nextFix.accuracyM ?? 'n/a'} m`
            );
            setLocked(shouldLock);
          }
        },
        (reason) => log(`ERROR location watcher: ${reason}`)
      );
      setWatching(true);
      log('watching location');
    } catch (error) {
      log(`ERROR starting location: ${errorMessage(error)}`);
    }
  };

  const stop = () => {
    subscription.current?.remove();
    subscription.current = null;
    setWatching(false);
    lockedRef.current = false;
    setLocked(false);
    log('stopped watching');
  };

  return (
    <View style={styles.flex}>
      <Screen>
        <Section title={`Speed lock (threshold ${SPEED_LOCK_THRESHOLD_KMH} km/h)`}>
          <Note>
            Walk, then ride a motorbike or car (as a passenger) above and below the threshold. Film the screen next to
            the real speed. Also test with GPS off and under bad sky view. The threshold is a default only; the real
            value comes from the backend rules.
          </Note>
          <KeyValue label="Permission" value={permission} />
          <KeyValue label="Location services on" value={servicesOn} />
          {watching ? <Button label="Stop" onPress={stop} /> : <Button label="Start watching GPS" onPress={() => void start()} />}
          {permission === 'denied' ? <Button label="Open app settings" onPress={() => void Linking.openSettings()} /> : null}
          <KeyValue label="Speed" value={fix?.speedKmh == null ? 'n/a' : `${fix.speedKmh.toFixed(1)} km/h`} />
          <KeyValue label="Accuracy" value={fix?.accuracyM == null ? 'n/a' : `${fix.accuracyM.toFixed(1)} m`} />
          <KeyValue label="Fix age at callback" value={fix === null ? '-' : `${fix.fixAgeMs} ms`} />
          <KeyValue label="Callback to overlay layout" value={renderLatency} />
        </Section>
        <Section title="Log (newest first)">
          <LogView logger={logger} />
        </Section>
      </Screen>
      {locked ? (
        <View style={styles.overlay} pointerEvents="auto">
          <Text style={styles.overlayText}>Moving: screen locked</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(176,0,32,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: colors.bg, fontSize: 24, fontWeight: '700' },
});
