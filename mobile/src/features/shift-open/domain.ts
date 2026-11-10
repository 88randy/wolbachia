import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";

export interface Check {
  readonly item: string;
  readonly result: Schemas["CheckResultEnum"];
  readonly note?: string;
}
export type Step = "motorcycle" | "checklist" | "odometer" | "maps";
export interface OpenShiftDraft {
  readonly clientShiftId: string;
  readonly openingEventId: string;
  readonly catalogVersion: string;
  readonly motorcycle_code: string;
  readonly checks: readonly Check[];
  /** Keep raw input so an incomplete or decreased reading survives restart. */
  readonly odometer_km: string;
  readonly photoRefs: readonly string[];
  readonly note: string;
  readonly step: Step;
}
export type ChecklistItem = Pick<
  Schemas["SnapshotItem"],
  "code" | "label_es" | "label_en" | "is_other" | "requires_photo"
>;
/** One motorcycle of the downloaded fleet list (the courier picks it, never types its code). */
export interface MotorcycleOption {
  readonly code: string;
  readonly plate: string;
  readonly isBlocked: boolean;
}
export interface ChecklistCatalog {
  readonly version: string;
  /** Fleet list from the snapshot; absent in catalogs stored before this field existed. */
  readonly motorcycles?: readonly MotorcycleOption[];
  /** /field/catalog/ only returns ACTIVE items. */
  readonly items: readonly ChecklistItem[];
  readonly blockedMotorcycles?: readonly string[];
  readonly sampleOrigins?: readonly ChecklistItem[];
}
export interface MapAsset {
  readonly id: string;
  readonly license: string;
  readonly size?: number;
  readonly sha256?: string;
}
export interface VerifiedAsset {
  readonly id: string;
  readonly fileRef: string;
  readonly size: number;
  readonly sha256?: string;
}
export interface MapPreparation {
  readonly status: "unavailable" | "preparing" | "ready" | "failed";
  readonly version: string | null;
  readonly requiredCoverage: readonly string[];
  readonly coverage: readonly string[];
  readonly assets: readonly MapAsset[];
  readonly verifiedAssets: readonly VerifiedAsset[];
  readonly progress: number;
  readonly error: string | null;
}
/** B-13 supplies the manifest; implementations verify licensed PMTiles on disk, never GPS/network flags. */
export interface MapPreparationSource {
  prepare(
    publish: (progress: MapPreparation) => Promise<void>,
    previous?: MapPreparation | null,
  ): Promise<MapPreparation>;
}
export interface PhotoCapturePort {
  capture(): Promise<
    | { readonly status: "captured"; readonly fileRef: string }
    | { readonly status: "unavailable" | "cancelled" }
  >;
}
export const UNAVAILABLE_MAP: MapPreparation = {
  status: "unavailable",
  version: null,
  requiredCoverage: [],
  coverage: [],
  assets: [],
  verifiedAssets: [],
  progress: 0,
  error: null,
};
function matchesAsset(asset: MapAsset, verified: readonly VerifiedAsset[]): boolean {
  const file = verified.find((candidate) => candidate.id === asset.id);
  return Boolean(
    asset.license.trim() &&
    asset.id.endsWith(".pmtiles") &&
    file?.fileRef &&
    file.size > 0 &&
    (asset.size === undefined || asset.size === file.size) &&
    (asset.sha256 === undefined || asset.sha256 === file.sha256),
  );
}
/** Ready requires explicit nonempty coverage and every manifest file verified against size/hash when provided. */
export function isMapReady(map: MapPreparation | null): boolean {
  if (map === null || map.status !== "ready" || map.error !== null || !map.version) return false;
  return (
    map.requiredCoverage.length > 0 &&
    map.assets.length > 0 &&
    map.requiredCoverage.every((area) => map.coverage.includes(area)) &&
    map.assets.every((asset) => matchesAsset(asset, map.verifiedAssets))
  );
}
export type Gate =
  | "closed"
  | "motorcycle"
  | "unconfigured"
  | "checklist"
  | "note"
  | "photo"
  | "odometer"
  | "map"
  | "severe"
  | "rejected"
  | "catalogChanged";
export interface GateInput {
  readonly draft: OpenShiftDraft;
  readonly catalog: ChecklistCatalog | null;
  readonly map: MapPreparation | null;
}
function checklistGate({ draft, catalog }: GateInput): Gate | null {
  if (!catalog?.items.length) return "unconfigured";
  if (draft.catalogVersion !== catalog.version) return "catalogChanged";
  const checks = catalog.items.map((item) =>
    draft.checks.find((check) => check.item === item.code),
  );
  if (checks.some((check) => check === undefined)) return "checklist";
  if (
    catalog.items.some(
      (item, index) =>
        (item.is_other || checks[index]?.result === "severe") && !checks[index]?.note?.trim(),
    )
  )
    return "note";
  return null;
}
/** Severe evidence may be captured, but can never authorize departure. */
export function departureGate(input: GateInput): Gate | null {
  const { draft, catalog, map } = input;
  if (isMotorcycleBlocked(draft, catalog)) return "motorcycle";
  const incomplete = checklistGate(input);
  if (incomplete !== null) return incomplete;
  if (!isOdometerValid(draft.odometer_km)) return "odometer";
  if (draft.checks.some((check) => check.result === "severe")) return "severe";
  if (
    (catalog?.items.some((item) => item.requires_photo) ||
      draft.checks.some((check) => check.result === "minor")) &&
    !draft.photoRefs.length
  )
    return "photo";
  return isMapReady(map) ? null : "map";
}
/** Receipt and review are different facts; pending, sending and local errors only prove phone storage. */
export function deliveryKey(opening: OutboxEvent): MessageKey {
  if (opening.status === "in_review") return "mobile.shiftOpen.receivedInReview";
  if (opening.status === "rejected") return "mobile.shiftOpen.receivedRejected";
  const received = opening.status === "sent";
  return received ? "mobile.shiftOpen.serverReceived" : "mobile.shiftOpen.phoneSaved";
}

function isMotorcycleBlocked(draft: OpenShiftDraft, catalog: ChecklistCatalog | null): boolean {
  return (
    !draft.motorcycle_code.trim() ||
    Boolean(catalog?.blockedMotorcycles?.includes(draft.motorcycle_code.trim()))
  );
}
function isOdometerValid(reading: string): boolean {
  return /^\d+$/.test(reading) && Number.isSafeInteger(Number(reading));
}
