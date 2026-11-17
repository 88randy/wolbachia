import type { SqlExecutor } from "../../db/sql.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { OvitrapService } from "../ovitrap-check/service.ts";
import { LabelPoolStore } from "../ovitrap-check/label-pool.ts";
import { ScannerService } from "./service.ts";
import type { ScannerResource } from "./resource-source.ts";
import { readScannerResources } from "./resource-source.ts";
import type { SampleService } from "../samples/service.ts";
import { sampleScannerRoute } from "./sample-route.ts";

export function createScanner(
  db: SqlExecutor,
  bundle: DayBundleService,
  captures: { readonly ovitrap: OvitrapService; readonly samples?: SampleService },
) {
  const { ovitrap, samples } = captures;
  const labels = new LabelPoolStore(db);
  return new ScannerService({
    sample: samples
      ? (input, isCurrent) => sampleScannerRoute(input, samples, isCurrent)
      : undefined,
    read: () => bundle.captureLifecycleSource(),
    resources: async (turn) => withPoolCodes(await readScannerResources(db, turn), labels),
    ovitrap,
  });
}

/** A trap placed on this phone and not yet downloaded still has its label code in the pool. */
async function withPoolCodes(
  resources: readonly ScannerResource[],
  labels: LabelPoolStore,
): Promise<readonly ScannerResource[]> {
  if (!resources.some((item) => item.kind === "ovitrap" && !item.shortCode)) return resources;
  const pool = await labels.read();
  return resources.map((item) =>
    item.kind === "ovitrap" && !item.shortCode
      ? { ...item, shortCode: pool.find((label) => label.id === item.id)?.code ?? null }
      : item,
  );
}
