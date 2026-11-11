/**
 * Hands one photo request at a time to the in-app camera screen. The photo ports ask; the host
 * (always mounted in the app shell) shows the camera and answers with the file or `null`.
 */
export class CameraBroker {
  #resolve: ((fileUri: string | null) => void) | null = null;
  readonly #listeners = new Set<() => void>();

  isOpen = (): boolean => this.#resolve !== null;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  request(): Promise<string | null> {
    if (this.#resolve !== null) return Promise.reject(new Error("camera_busy"));
    return new Promise((resolve) => {
      this.#resolve = resolve;
      this.#notify();
    });
  }

  /** `null` means the courier closed the camera without keeping a photo. */
  settle = (fileUri: string | null): void => {
    const resolve = this.#resolve;
    this.#resolve = null;
    this.#notify();
    resolve?.(fileUri);
  };

  #notify(): void {
    this.#listeners.forEach((listener) => {
      listener();
    });
  }
}

export const cameraBroker = new CameraBroker();
