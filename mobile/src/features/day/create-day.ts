import type { TokenStore } from "../../auth/token-store.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import { createScopedApiClient } from "../../api/create-scoped-api-client.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { KvStore } from "../../db/kv-store.ts";
import { androidNavigation } from "../../navigation/android-navigation.ts";
import { NavigationService } from "../../navigation/navigation-service.ts";
import { ShiftOpenStore } from "../shift-open/store.ts";
import { UNAVAILABLE_MAP } from "../shift-open/domain.ts";
import { DayBundleService } from "./bundle-service.ts";
import { createBootstrapTransport } from "./bootstrap-transport.ts";
import { DayStore } from "./store.ts";
import { DayService } from "./service.ts";
import { androidLocation } from "./android-location.ts";
import { inspectMapFile } from "./inspect-map-file.ts";
import { OutboxWorkOverlay } from "./local-work.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: () => SessionRequests;
}
export function createDayBundle(deps: Dependencies): DayBundleService {
  return new DayBundleService({
    store: new DayStore(deps.db),
    now: () => new Date(),
    getScopeKey: () => sessionScope(deps.tokens),
    transport: async (etag) => {
      const baseUrl = deps.tokens.getOrigin();
      const scope = sessionScope(deps.tokens);
      if (baseUrl === null || scope === null)
        throw new Error("Bootstrap requires a server and session.");
      const result = await createBootstrapTransport(
        createScopedApiClient({ tokens: deps.tokens }),
        deps.requests(),
      )(etag);
      if (scope !== sessionScope(deps.tokens)) throw new Error("Bootstrap session changed.");
      return result;
    },
  });
}
function sessionScope(tokens: Dependencies["tokens"]): string | null {
  const current = tokens.getSnapshot();
  return current.status === "active" && current.pair !== null
    ? JSON.stringify([current.sessionId, current.origin])
    : null;
}
async function hasOpenShift(db: SqlExecutor): Promise<boolean> {
  const rows =
    await db.query(`SELECT 1 FROM outbox_event opening WHERE type='shift.open' AND local_status!='rejected'
    AND NOT EXISTS (SELECT 1 FROM outbox_event closing WHERE closing.type='shift.close' AND closing.shift_id=opening.shift_id AND closing.local_status!='rejected') LIMIT 1`);
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
    location: androidLocation,
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    inspect: inspectMapFile,
    hasOpenShift: () => hasOpenShift(db),
  });
}
