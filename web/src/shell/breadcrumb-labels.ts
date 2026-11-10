import { useEffect, useSyncExternalStore } from "react";

/**
 * Display names for record segments of the breadcrumb (a catalog slug, a person id): a screen
 * that knows the human name of the record in its URL registers it, and the breadcrumb shows
 * that name instead of the raw segment. Keys are full paths (`/settings/catalogs/<slug>`).
 */
const labels = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function publish() {
  version += 1;
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Registers the display name of `path` while the calling screen is mounted. */
export function useBreadcrumbLabel(path: string, label: string | undefined) {
  useEffect(() => {
    if (!label) return;
    labels.set(path, label);
    publish();
    return () => {
      labels.delete(path);
      publish();
    };
  }, [path, label]);
}

/** The registered display name of a breadcrumb path, if any. */
export function useBreadcrumbLabelOf(path: string): string | undefined {
  useSyncExternalStore(subscribe, () => version);
  return labels.get(path);
}
