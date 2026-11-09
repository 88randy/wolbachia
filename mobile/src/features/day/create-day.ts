import type { SqlExecutor } from "../../db/sql.ts";
import { KvStore } from "../../db/kv-store.ts";
import { androidNavigation } from "../../navigation/android-navigation.ts";
import { NavigationService } from "../../navigation/navigation-service.ts";
import { ShiftOpenStore } from "../shift-open/store.ts";
import { UNAVAILABLE_MAP } from "../shift-open/domain.ts";
import { DayBundleService } from "./bundle-service.ts";
import { DayService } from "./service.ts";
import { ShiftLocationSource } from "../shift-close/location.ts";
import { androidLocation } from "./android-location.ts";
import { inspectMapFile } from "./inspect-map-file.ts";
import { OutboxWorkOverlay } from "./local-work.ts";
export { createDayBundle } from "./create-day-bundle.ts";
async function hasOpenShift(db: SqlExecutor): Promise<boolean> {
  const rows =
    await db.query(`SELECT 1 FROM outbox_event opening WHERE type='shift.open' AND local_status!='rejected'
    AND NOT EXISTS (SELECT 1 FROM outbox_event closing WHERE closing.type='shift.close' AND closing.shift_id=opening.shift_id) LIMIT 1`);
  return rows.length > 0;
}
/** [ASSUMPTION] Production download stays unavailable: manifests publish no asset URL. M-04 owns preparation. */
export function createDay(db: SqlExecutor, bundle: DayBundleService): DayService {
  const kv = new KvStore(db);
  return new DayService({
    bundle,
    kv,
    shift: new ShiftOpenStore(db),
    work: new OutboxWorkOverlay(db),
    navigation: new NavigationService({ kv, launcher: androidNavigation, now: () => new Date() }),
    location: new ShiftLocationSource(androidLocation, () => hasOpenShift(db)),
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    inspect: inspectMapFile,
    hasOpenShift: () => hasOpenShift(db),
  });
}
