import { acceptedEvidenceOwner } from "../../attachments/accepted-owner.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { AuthController } from "../../auth/auth-controller.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import {
  readTrainingSource,
  saveTrainingRecords,
  clearTrainingProjectionForSource,
} from "./projection-state.ts";
import type { TrainingRecords, TrainingSource } from "./types.ts";
import { TrainingUnavailable } from "./types.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly auth: AuthController;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly bundle: DayBundleService;
  readonly deviceId: string;
  readonly remote: (subject: string, source: TrainingSource) => Promise<TrainingRecords>;
}
export class TrainingService {
  readonly #deps: Dependencies;
  readonly #listeners = new Set<() => void>();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    const unsubscribe = this.#deps.bundle.subscribe(listener);
    return () => {
      this.#listeners.delete(listener);
      unsubscribe();
    };
  };
  #identity(): EvidenceIdentity {
    const auth = this.#deps.auth.getSnapshot();
    const identity = acceptedEvidenceOwner({
      profile: auth.profile,
      credentials: this.#deps.tokens.getSnapshot(),
      deviceId: this.#deps.deviceId,
    });
    if (auth.phase !== "unlocked" || identity === null)
      throw new TrainingUnavailable("Training session unavailable.");
    return identity;
  }
  #assertIdentity(expected: EvidenceIdentity) {
    const current = this.#identity();
    if (
      current.sessionId !== expected.sessionId ||
      ownerKey(current.owner) !== ownerKey(expected.owner)
    )
      throw new TrainingUnavailable("Training session changed.");
  }
  async read(): Promise<TrainingSource> {
    const identity = this.#identity(),
      write = this.#deps.bundle.captureProjectionWriter();
    return write(async () => {
      this.#assertIdentity(identity);
      const source = await readTrainingSource(this.#deps.db, identity);
      this.#assertIdentity(identity);
      return source;
    });
  }
  async refresh(): Promise<void> {
    await this.#deps.bundle.refresh();
    const identity = this.#identity(),
      write = this.#deps.bundle.captureProjectionWriter();
    const source = await write(() => readTrainingSource(this.#deps.db, identity));
    try {
      const records = await this.#deps.remote(identity.owner.userId, source);
      await write(() => {
        this.#assertIdentity(identity);
        return saveTrainingRecords(this.#deps.db, source, records);
      });
      for (const listener of this.#listeners) listener();
    } catch (error) {
      if (isDenied(error))
        await write(() => clearTrainingProjectionForSource(this.#deps.db, source));
      throw error;
    }
  }
}
function isDenied(error: unknown): boolean {
  return (
    error instanceof Error && "status" in error && (error.status === 401 || error.status === 403)
  );
}
