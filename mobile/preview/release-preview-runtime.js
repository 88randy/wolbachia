import { INITIAL_SNAPSHOT } from "../src/sync/sync-snapshot.ts";

const PREVIEW_SYNC = { ...INITIAL_SNAPSHOT, isOnline: false };
const ignore = () => undefined;
const PREVIEW_NAVIGATION = {
  route: { name: "releaseCapture", taskId: null, deviceId: null, manualCapture: false },
  canGoBack: false,
  push: ignore,
  goBack: ignore,
};

// Browser-only header boundaries. Never create app services, a queue, storage or API access.
export function useNavigation() {
  return PREVIEW_NAVIGATION;
}
export function useSyncSnapshot() {
  return PREVIEW_SYNC;
}
