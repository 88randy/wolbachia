import { Directory, File, Paths } from "expo-file-system";

const EXTRACT = "merida";
const MIN_BYTES = 1024;

/** Where the downloaded extract lives. The same file is reused offline. */
function target(): { readonly dir: Directory; readonly file: File; readonly part: File } {
  const dir = new Directory(Paths.document, "maps");
  return {
    dir,
    file: new File(dir, `${EXTRACT}.pmtiles`),
    part: new File(dir, `${EXTRACT}.pmtiles.part`),
  };
}

export function cachedTilesUri(): string | null {
  const { file } = target();
  return file.exists && file.size >= MIN_BYTES ? file.uri : null;
}

/**
 * Downloads our own vector extract once (public map data served by our backend, never by
 * tile.openstreetmap.org). The partial file is moved into place only when complete.
 */
export async function downloadTiles(origin: string): Promise<string> {
  const { dir, file, part } = target();
  dir.create({ idempotent: true, intermediates: true });
  const url = `${origin}/api/v1/map-tiles/${EXTRACT}.pmtiles`;
  const result = await File.downloadFileAsync(url, part, { idempotent: true });
  if (result.size < MIN_BYTES) {
    part.delete();
    throw new Error("Map download incomplete.");
  }
  await part.move(file, { overwrite: true });
  return file.uri;
}
