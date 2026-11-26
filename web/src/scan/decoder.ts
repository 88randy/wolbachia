import { BarcodeDetector as PonyfillDetector, prepareZXingModule } from "barcode-detector/ponyfill";
// The decoder engine (WebAssembly) ships inside our own bundle: nothing loads from a CDN.
import readerWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { Decoder } from "./decoder-types";

/** QR, the 1D barcodes labels and suppliers use, and DataMatrix (GS1 DataMatrix). */
const FORMATS = [
  "qr_code",
  "code_128",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_39",
  "itf",
  "data_matrix",
] as const;
/** The browser engine is used only when it reads at least these. */
const REQUIRED = ["qr_code", "code_128"];

interface DetectorLike {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
interface NativeDetectorConstructor {
  new (options: { formats: string[] }): DetectorLike;
  getSupportedFormats: () => Promise<string[]>;
}

function nativeConstructor(): NativeDetectorConstructor | null {
  const native = (globalThis as { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
  return native ?? null;
}

async function detectorFor(): Promise<DetectorLike> {
  const native = nativeConstructor();
  if (native !== null) {
    const supported = await native.getSupportedFormats().catch(() => [] as string[]);
    if (REQUIRED.every((format) => supported.includes(format))) {
      return new native({ formats: FORMATS.filter((format) => supported.includes(format)) });
    }
  }
  void prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? readerWasmUrl : `${prefix}${path}`,
    },
    fireImmediately: true,
  });
  return new PonyfillDetector({ formats: [...FORMATS] });
}

/** Browser BarcodeDetector when it is complete, else the zxing-wasm ponyfill. Loaded on demand. */
export async function loadDecoder(): Promise<Decoder> {
  const detector = await detectorFor();
  return {
    async read(video) {
      const found = await detector.detect(video);
      return found[0]?.rawValue ?? null;
    },
  };
}
