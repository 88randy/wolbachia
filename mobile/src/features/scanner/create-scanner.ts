import type { SqlExecutor } from "../../db/sql.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { OvitrapService } from "../ovitrap-check/service.ts";
import { ScannerService } from "./service.ts";
import { readScannerResources } from "./resource-source.ts";

export function createScanner(db: SqlExecutor, bundle: DayBundleService, ovitrap: OvitrapService) {
  return new ScannerService({
    read: () => bundle.captureLifecycleSource(),
    resources: (turn) => readScannerResources(db, turn),
    ovitrap,
  });
}
