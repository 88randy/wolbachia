/** One scan owns its continuation. Explicit rearm allows the same resource in a later capture. */
export class ScannerSession {
  #revision = 0;
  #isBusy = false;
  #last: string | null = null;
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
    if (this.#isBusy || this.#last === key) return "duplicate";
    const revision = this.#revision;
    this.#isBusy = true;
    try {
      const result = await action(() => revision === this.#revision);
      if (revision === this.#revision) this.#last = key;
      return result;
    } finally {
      if (revision === this.#revision) this.#isBusy = false;
    }
  }
}
