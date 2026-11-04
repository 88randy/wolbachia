import * as Location from 'expo-location';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { SPEED_LOCK_THRESHOLD_KMH } from '../config';
import {
  Button,
  KeyValue,
  LogView,
  Note,
  Screen,
  Section,
  colors,
  errorMessage,
  formatMs,
  useIsMounted,
  useLog,
} from '../ui';

const MS_TO_KMH = 3.6;
/** No fix for longer than this: the speed is unknown and the overlay must not stay stuck. */
const FIX_STALE_AFTER_MS = 3000;
const STALENESS_CHECK_MS = 1000;

type Fix = {
  speedKmh: number | null;
  accuracyM: number | null;
  /**
   * Date.now() minus the fix timestamp when our callback ran. The fix timestamp comes from the location
   * provider (GNSS time or system time depending on the provider), so this mixes two clocks.
   */
  fixAgeMs: number;
};

export function SpeedLockScreen() {
  const logger = useLog();
  const { log } = logger;
  const mounted = useIsMounted();
  const [permission, setPermission] = useState<string>('unknown');
  const [precision, setPrecision] = useState<string>('unknown');
  const [servicesOn, setServicesOn] = useState<string>('unknown');
  const [watching, setWatching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [stale, setStale] = useState(false);
  const [locked, setLocked] = useState(false);
  const [renderLatency, setRenderLatency] = useState('-');
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const startingRef = useRef(false);
  const callbackAt = useRef<number | null>(null);
  const lastFixAt = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const staleRef = useRef(false);

  // Measures the commit after the state change (layout effect), not the paint on screen.
  useLayoutEffect(() => {
    if (callbackAt.current === null) return;
    const elapsed = performance.now() - callbackAt.current;
    callbackAt.current = null;
    setRenderLatency(formatMs(elapsed));
  }, [locked]);

  const removeSubscription = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  useEffect(() => removeSubscription, [removeSubscription]);

  const applyLock = useCallback(
    (shouldLock: boolean, reason: string) => {
      if (lockedRef.current === shouldLock) return;
      lockedRef.current = shouldLock;
      callbackAt.current = performance.now();
      log(`${shouldLock ? 'LOCK shown' : 'LOCK hidden'}: ${reason}`);
      setLocked(shouldLock);
    },
    [log]
  );

  const onLocation = useCallback(
    (location: Location.LocationObject) => {
      if (!mounted.current) return;
      lastFixAt.current = performance.now();
      if (staleRef.current) {
        staleRef.current = false;
        setStale(false);
        log('GPS fix recovered');
      }
      const rawSpeed = location.coords.speed;
      // expo-location reports speed in m/s. A negative value means "unknown" on some devices.
      const speedKmh = rawSpeed !== null && rawSpeed >= 0 ? rawSpeed * MS_TO_KMH : null;
      const nextFix: Fix = {
        speedKmh,
        accuracyM: location.coords.accuracy,
        fixAgeMs: Date.now() - location.timestamp,
      };
      setFix(nextFix);
      const shown = speedKmh === null ? 'n/a' : speedKmh.toFixed(1);
      applyLock(
        speedKmh !== null && speedKmh > SPEED_LOCK_THRESHOLD_KMH,
        `${shown} km/h, fix age ${nextFix.fixAgeMs} ms, accuracy ${nextFix.accuracyM ?? 'n/a'} m`
      );
    },
    [applyLock, log, mounted]
  );

  // Staleness watchdog: when the GPS goes silent the last speed must not keep the overlay on forever.
  useEffect(() => {
    if (!watching) return undefined;
    const timer = setInterval(() => {
      const last = lastFixAt.current;
      if (last === null || performance.now() - last <= FIX_STALE_AFTER_MS) return;
      if (!staleRef.current) {
        staleRef.current = true;
        setStale(true);
        log(`WARNING no GPS fix for more than ${FIX_STALE_AFTER_MS} ms: speed unknown`);
        applyLock(false, 'speed unknown (no fix)');
      }
      Location.hasServicesEnabledAsync()
        .then((enabled) => {
          if (mounted.current) setServicesOn(String(enabled));
        })
        .catch((error: unknown) => log(`ERROR checking location services: ${errorMessage(error)}`));
    }, STALENESS_CHECK_MS);
    return () => clearInterval(timer);
  }, [applyLock, log, mounted, watching]);

  const requestAccess = async (): Promise<boolean> => {
    const granted = await Location.requestForegroundPermissionsAsync();
    if (!mounted.current) return false;
    setPermission(granted.status);
    if (granted.status !== Location.PermissionStatus.GRANTED) {
      log('location permission not granted');
      return false;
    }
    // On Android 12+ the user can grant approximate location only (expo-location: android.accuracy).
    const level = granted.android?.accuracy ?? 'unknown';
    setPrecision(level);
    if (level !== 'fine') log(`WARNING location precision is "${level}": speed readings are not reliable`);
    return true;
  };

  const start = async () => {
    if (startingRef.current || subscription.current !== null) return;
    startingRef.current = true;
    setStarting(true);
    try {
      if (!(await requestAccess())) return;
      const enabled = await Location.hasServicesEnabledAsync();
      if (!mounted.current) return;
      setServicesOn(String(enabled));
      if (!enabled) log('WARNING: location services are OFF on the phone');
      const created = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        onLocation,
        (reason) => log(`ERROR location watcher: ${reason}`)
      );
      // Unmounted while waiting, or another subscription won the race: drop this one.
      if (!mounted.current || subscription.current !== null) {
        created.remove();
        return;
      }
      subscription.current = created;
      lastFixAt.current = performance.now();
      setWatching(true);
      log('watching location');
    } catch (error) {
      log(`ERROR starting location: ${errorMessage(error)}`);
    } finally {
      startingRef.current = false;
      if (mounted.current) setStarting(false);
    }
  };

  const stop = () => {
    removeSubscription();
    setWatching(false);
    staleRef.current = false;
    setStale(false);
    applyLock(false, 'stopped');
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
          <KeyValue label="Precision granted" value={precision} />
          <KeyValue label="Location services on" value={servicesOn} />
          <KeyValue label="GPS signal" value={stale ? 'LOST (speed unknown)' : watching ? 'ok' : '-'} />
          {watching ? (
            <Button label="Stop" onPress={stop} />
          ) : (
            <Button label="Start watching GPS" onPress={() => void start()} disabled={starting} />
          )}
          {permission === 'denied' ? <Button label="Open app settings" onPress={() => void Linking.openSettings()} /> : null}
          <KeyValue label="Speed" value={fix?.speedKmh == null || stale ? 'n/a' : `${fix.speedKmh.toFixed(1)} km/h`} />
          <KeyValue label="Accuracy" value={fix?.accuracyM == null ? 'n/a' : `${fix.accuracyM.toFixed(1)} m`} />
          <KeyValue label="Fix age at callback" value={fix === null ? '-' : `${fix.fixAgeMs} ms`} />
          <KeyValue label="Callback to overlay commit" value={renderLatency} />
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
