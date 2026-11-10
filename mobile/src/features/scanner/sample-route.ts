import { parseQr } from "../ovitrap-check/domain.ts";
import type { SampleService } from "../samples/service.ts";
import type { ScannerInput } from "./domain.ts";
import type { ScannerDestination } from "./service.ts";

/** A new sample QR supplies an identity; the capture reader owns admission. */
export async function sampleScannerRoute(
  input: ScannerInput,
  samples: Pick<SampleService, "admit">,
  isCurrent: () => boolean,
): Promise<ScannerDestination | null> {
  if (input.isManual) return null;
  const parsed = parseQr(input.value);
  if (parsed?.kind !== "sample") return null;
  if (input.expected && input.expected !== "sample") return { error: "kind" };
  if (!isCurrent() || !(await samples.admit(parsed.id, isCurrent)) || !isCurrent())
    return { error: "unavailable" };
  return {
    route: {
      name: "sampleCapture",
      sampleId: parsed.id,
      sourceRef: null,
      manualCapture: false,
    },
  };
}
