import type { AuthController } from "../../auth/auth-controller.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import { createTrainingRemote } from "./remote.ts";
import { TrainingService } from "./service.ts";

interface Input {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly bundle: DayBundleService;
  readonly deviceId: string;
}
export function createTraining(input: Input): TrainingService {
  return new TrainingService({ ...input, remote: createTrainingRemote(input) });
}
