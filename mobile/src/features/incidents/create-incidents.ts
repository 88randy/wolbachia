import { randomUUID } from "expo-crypto";
import { Linking } from "react-native";
import type { SqlExecutor } from "../../db/sql.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import { readIncidentShift } from "./shift.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import { IncidentService } from "./service.ts";
import { IncidentStore } from "./store.ts";
import { createIncidentRemote } from "./remote.ts";
import { lastIncidentGps } from "./native-gps.ts";
interface Input {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly attachments: Attachments;
  readonly bundle: DayBundleService;
  readonly shiftOpen: ShiftOpenService;
  readonly engine: SyncEngine;
  readonly evidence: EvidencePort;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
}
export function createIncidents(input: Input): IncidentService {
  return new IncidentService({
    ...input,
    store: new IncidentStore(input.db),
    current: input.attachments.session.deps.current,
    canCapture: () => input.auth.getSnapshot().phase === "unlocked",
    shift: () => readIncidentShift(input.shiftOpen),
    photo: input.evidence,
    lastGps: lastIncidentGps,
    remote: createIncidentRemote(input),
    dialer: { open: (uri) => Linking.openURL(uri) },
    uuid: randomUUID,
    now: () => new Date(),
  });
}
