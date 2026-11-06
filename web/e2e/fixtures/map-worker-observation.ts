import type { Page } from "@playwright/test";

interface WorkerObservation {
  urls: string[];
  messages: number;
  errors: string[];
}
type ObservedWindow = Window & typeof globalThis & { mapWorkers: WorkerObservation };

/** Observe native public Worker events; constructor, execution and messages stay real. */
function observeWorkerEvents() {
  const target = window as ObservedWindow;
  const NativeWorker = window.Worker;
  const observations: WorkerObservation = { urls: [], messages: 0, errors: [] };
  target.mapWorkers = observations;
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      observations.urls.push(String(url));
      this.addEventListener("message", () => {
        observations.messages += 1;
      });
      this.addEventListener("error", (event) => {
        observations.errors.push(event.message);
      });
    }
  };
}

export async function observeMapWorkers(page: Page) {
  await page.addInitScript(observeWorkerEvents);
}

export async function readMapWorkers(page: Page): Promise<WorkerObservation> {
  return page.evaluate(() => (window as ObservedWindow).mapWorkers);
}
