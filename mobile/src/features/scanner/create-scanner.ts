import type { SqlExecutor } from "../../db/sql.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { OvitrapService } from "../ovitrap-check/service.ts";
import { ScannerService } from "./service.ts";
import { readScannerResources } from "./resource-source.ts";
import type { SampleService } from "../samples/service.ts";
import { sampleScannerRoute } from "./sample-route.ts";

export function createScanner(
  db: SqlExecutor,
  bundle: DayBundleService,
  captures: { readonly ovitrap: OvitrapService; readonly samples?: SampleService },
) {
  const { ovitrap, samples } = captures;
  return new ScannerService({
    sample: samples
      ? (input, isCurrent) => sampleScannerRoute(input, samples, isCurrent)
      : undefined,
    read: () => bundle.captureLifecycleSource(),
    resources: (turn) => readScannerResources(db, turn),
    ovitrap,
  });
}
