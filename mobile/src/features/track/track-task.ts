import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { PermissionsAndroid, Platform } from "react-native";
import type { NativeTrackApi } from "./track-recorder.ts";
import type { RawFix } from "./track-filter.ts";

export const TRACK_TASK = "wolbachia-courier-track";
/** JS wakes once a minute with the batch while the app is paused (expo-location: deferred delivery). */
const DEFERRED_UPDATES_MS = 60_000;

let handler: ((fixes: readonly RawFix[]) => Promise<void>) | null = null;

/** The recorder receives the task's fixes; before it exists, fixes are dropped. */
export function setTrackHandler(next: typeof handler): void {
  handler = next;
}

// Defined at module scope, as expo-task-manager requires, before any start can deliver fixes.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  TRACK_TASK,
  async ({ data, error }) => {
    if (error !== null || handler === null) return;
    await handler(
      (data.locations ?? []).map((fix) => ({
        at: fix.timestamp,
        lat: fix.coords.latitude,
        lng: fix.coords.longitude,
        accuracyM: fix.coords.accuracy,
      })),
    );
  },
);

async function isNotificationGranted(): Promise<boolean> {
  // Android 13 (API 33) added the runtime notification permission; older versions grant it.
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/** Android location foreground service; no ACCESS_BACKGROUND_LOCATION (started in the foreground). */
export const nativeTrack: NativeTrackApi = {
  async prepare() {
    const isLocationGranted = (await Location.requestForegroundPermissionsAsync()).granted;
    return { isLocationGranted, isNotificationGranted: await isNotificationGranted() };
  },
  start: (options) =>
    Location.startLocationUpdatesAsync(TRACK_TASK, {
      accuracy: options.isHighAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
      timeInterval: options.timeIntervalMs,
      // The movement filter runs in JS: a native distance would silence a still phone.
      distanceInterval: 0,
      deferredUpdatesInterval: DEFERRED_UPDATES_MS,
      mayShowUserSettingsDialog: false,
      foregroundService: {
        notificationTitle: options.notificationTitle,
        notificationBody: options.notificationBody,
        killServiceOnDestroy: true,
      },
    }),
  stop: () => Location.stopLocationUpdatesAsync(TRACK_TASK),
  isRunning: () => Location.hasStartedLocationUpdatesAsync(TRACK_TASK).catch(() => false),
};
