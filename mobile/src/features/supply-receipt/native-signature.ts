import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type Svg from "react-native-svg";
import { ReceiptError } from "./domain.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { MAX_EVIDENCE_BYTES, UPLOAD_DEADLINE_MS } from "../../attachments/types.ts";

/** Export a real PNG, then let the shared journal copy/hash/own it before publication. */
export function nativeSignaturePort(svg: Svg | null): EvidencePort {
  return {
    capture: async (context) => {
      if (svg === null) throw new ReceiptError("signature_required");
      await context.assertCurrent();
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(UPLOAD_DEADLINE_MS)]);
      const base64 = await exportRaster(svg, signal);
      await context.assertCurrent();
      signal.throwIfAborted();
      if (base64.length > Math.ceil((MAX_EVIDENCE_BYTES * 4) / 3))
        throw new ReceiptError("evidence_required");
      const id = randomUUID();
      const directory = new Directory(Paths.document, "private-signature-source");
      directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, id);
      file.create({ overwrite: false });
      await file.write(base64, { encoding: "base64" });
      return { id, fileRef: file.uri };
    },
  };
}
function exportRaster(svg: Svg, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      reject(new ReceiptError("evidence_required"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    svg.toDataURL((base64) => {
      signal.removeEventListener("abort", abort);
      if (!signal.aborted) resolve(base64);
    });
  });
}
