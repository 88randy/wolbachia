/** Normalized assignments v2 task from scheduling/courier_feed.py. */
export interface AssignedTask {
  readonly id: string;
  readonly point_code: string;
  readonly point_id: string;
  readonly courier: string;
  readonly ovitrap_id?: string;
  readonly action: "place" | "check" | "replace" | "relocate" | "remove";
  readonly date: string;
  readonly risk: "high" | "normal";
  readonly version: string;
  readonly block_code?: string;
  readonly quadrant_id: string;
  /** Coordinates are joined from the current authorized sampling-point projection (#196/#221). */
  readonly lat?: number;
  readonly lng?: number;
  readonly reference?: string;
  readonly history: readonly { readonly date: string; readonly summary_code: string }[];
}
export interface MapManifest {
  readonly asset_id: string;
  readonly version: string;
  readonly sha256: string;
  readonly size_bytes: number;
  readonly quadrant_id: string;
  readonly licensed: boolean;
}
export interface CachedTask {
  readonly task: AssignedTask;
  readonly isKept: boolean;
}
export interface BundleMeta {
  readonly bundle_version: string;
  readonly schema_version: string;
  readonly scope_revision: string;
  readonly next_change_at: string | null;
  readonly map_manifest_ready: boolean;
  readonly fetched_at: string;
  readonly unreadable_rows: number;
}
export interface DayCache {
  readonly tasks: readonly CachedTask[];
  readonly manifests: readonly MapManifest[];
  readonly meta: BundleMeta | null;
}
export interface LocalWork {
  readonly captureDate: string;
  readonly action: string;
  readonly taskId: string | null;
  readonly ovitrapId: string | null;
  readonly status: string;
}
export interface LocalWorkOverlay {
  read(): Promise<readonly LocalWork[]>;
}
export interface ProjectionChange {
  readonly sequence: number;
  readonly action: "upsert" | "remove";
  readonly resource_type: string;
  readonly resource_id: string;
  readonly resource_version: string;
  readonly data: unknown;
}
