import type { TrainingSource } from "./types.ts";
export interface TrainingLoadState {
  readonly source: TrainingSource | null;
  readonly hasLocalError: boolean;
}
interface Dependencies {
  readonly read: () => Promise<TrainingSource>;
  readonly publish: (state: TrainingLoadState) => void;
}
/** Invalidation hides personal rows synchronously, before a queued SQLite read can start. */
export class TrainingLoader {
  readonly #deps: Dependencies;
  #revision = 0;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  invalidate = () => {
    this.#revision++;
  };
  read = async () => {
    const revision = ++this.#revision;
    this.#deps.publish({ source: null, hasLocalError: false });
    try {
      const source = await this.#deps.read();
      if (revision === this.#revision) this.#deps.publish({ source, hasLocalError: false });
    } catch {
      if (revision === this.#revision) this.#deps.publish({ source: null, hasLocalError: true });
    }
  };
}
