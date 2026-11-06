import { isManifestAvailable } from "./assignment-parser.ts";
import { isMapReady } from "../shift-open/domain.ts";
import type { MapPreparation, VerifiedAsset } from "../shift-open/domain.ts";
import type { MapManifest } from "./types.ts";
export interface MapFile {
  readonly fileRef: string;
  readonly quadrantId: string;
  readonly assetId: string;
}
export type MapState =
  { readonly kind: "unavailable" } | { readonly kind: "ready"; readonly files: readonly MapFile[] };
export type MapFileInspector = (
  asset: VerifiedAsset,
) => Promise<{ readonly sha256: string; readonly size: number }>;
interface VerifyInput {
  readonly preparation: MapPreparation | null;
  readonly manifests: readonly MapManifest[];
  readonly inspect: MapFileInspector;
}
async function verifyAsset(input: VerifyInput, manifest: MapManifest): Promise<MapFile | null> {
  const file = input.preparation?.verifiedAssets.find((asset) => asset.id === manifest.asset_id);
  if (!manifest.licensed || !file || !file.fileRef.startsWith("file:///")) return null;
  if (!input.preparation?.coverage.includes(manifest.quadrant_id)) return null;
  try {
    const actual = await input.inspect(file);
    if (actual.sha256 !== manifest.sha256 || actual.size !== manifest.size_bytes) return null;
    return { fileRef: file.fileRef, quadrantId: manifest.quadrant_id, assetId: manifest.asset_id };
  } catch {
    return null;
  } // Missing/unreadable/corrupt files make the list the safe alternative.
}
/** Reverify disk files before mounting the renderer, including after a cold start or retry. */
export async function verifyMap(input: VerifyInput): Promise<MapState> {
  if (
    !isMapReady(input.preparation) ||
    input.manifests.length === 0 ||
    !input.manifests.every(isManifestAvailable)
  )
    return { kind: "unavailable" };
  const files: MapFile[] = [];
  for (const manifest of input.manifests) {
    const file = await verifyAsset(input, manifest);
    if (file !== null) files.push(file);
  }
  return files.length === 0 ? { kind: "unavailable" } : { kind: "ready", files };
}
export function hasCoverage(quadrantId: string, map: MapState): boolean {
  return map.kind === "ready" && map.files.some((file) => file.quadrantId === quadrantId);
}
