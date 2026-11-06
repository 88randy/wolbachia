import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File, FileMode } from "expo-file-system";
import type { MapFileInspector } from "./map-coverage.ts";
/** [ASSUMPTION] Technical memory cap until streaming native SHA-256 is qualified on 4 GB devices. */
const MAX_VERIFY_BYTES = 32 * 1024 * 1024;
const PMTILES_HEADER_BYTES = 127;
/** Same file API/header approach as #64; never opens a remote URL. Only MVT v3 Protomaps archives are supported. */
export const inspectMapFile: MapFileInspector = async (asset) => {
  const file = new File(asset.fileRef);
  if (!file.exists || file.size > MAX_VERIFY_BYTES || file.size < PMTILES_HEADER_BYTES)
    throw new Error("Map file unavailable or exceeds verification memory limit.");
  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = handle.readBytesSync(PMTILES_HEADER_BYTES);
    if (
      String.fromCharCode(...header.subarray(0, 7)) !== "PMTiles" ||
      header[7] !== 3 ||
      header[99] !== 1
    )
      throw new Error("Unsupported PMTiles archive.");
  } finally {
    handle.close();
  }
  const checksum = await digest(CryptoDigestAlgorithm.SHA256, await file.bytes());
  return {
    size: file.size,
    sha256: Array.from(new Uint8Array(checksum), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    ),
  };
};
