/** The same code is not run twice in this window; after it, a legit retry goes through. */
export const SCAN_DEDUPE_MS = 3000;

/** One scan owns its continuation. Explicit rearm allows the same resource in a later capture. */
export class ScannerSession {
  #revision = 0;
  #isBusy = false;
  #last: { readonly key: string; readonly atMs: number } | null = null;
  readonly #now: () => number;
  constructor(now: () => number = Date.now) {
    this.#now = now;
  }
  get isBusy(): boolean {
    return this.#isBusy;
  }
  cancel(): void {
    this.#revision++;
    this.#isBusy = false;
    this.#last = null;
  }
  async run<T>(
    key: string,
    action: (isCurrent: () => boolean) => Promise<T>,
  ): Promise<T | "duplicate"> {
    if (this.#isBusy || this.#isRecent(key)) return "duplicate";
    const revision = this.#revision;
    this.#isBusy = true;
    try {
      const result = await action(() => revision === this.#revision);
      if (revision === this.#revision) this.#last = { key, atMs: this.#now() };
      return result;
    } finally {
      if (revision === this.#revision) this.#isBusy = false;
    }
  }
  #isRecent(key: string): boolean {
    return (
      this.#last !== null &&
      this.#last.key === key &&
      this.#now() - this.#last.atMs < SCAN_DEDUPE_MS
    );
  }
}
