import type { Page } from "@playwright/test";
import { web } from "@wolbachia/tokens";

const RESIZE_READY = "e2e:compact-resize-ready";
type ResizeBarrier = { query: string; ready: string };

/** Keep the previous React shell state while the browser applies its narrow CSS layout. */
function deferCompactChange({ query, ready }: ResizeBarrier) {
  const matchMedia = window.matchMedia.bind(window);
  let isReleased = false;
  window.addEventListener(
    ready,
    () => {
      isReleased = true;
    },
    { once: true },
  );
  window.matchMedia = (value) => {
    const media = matchMedia(value);
    if (value !== query) return media;
    // Other React renders must not release the barrier by reading a newer snapshot early.
    const isCompact = () => matchMedia(value).matches;
    Object.defineProperty(media, "matches", { get: () => isReleased && isCompact() });
    const subscribe = media.addEventListener.bind(media);
    Object.defineProperty(media, "addEventListener", {
      value: (type: string, listener: EventListener) => {
        subscribe(type, (event) => {
          const deliver = () => {
            listener(event);
          };
          if (isReleased || !isCompact()) deliver();
          else window.addEventListener(ready, deliver, { once: true });
        });
      },
    });
    return media;
  };
}

/** Expose the real resize/event ordering that previously let the theme switch overflow by 4px. */
export async function deferCompactResize(page: Page) {
  await page.addInitScript(deferCompactChange, {
    query: `(max-width: ${String(web.layout.compactBreakpoint)}px)`,
    ready: RESIZE_READY,
  });
}

export async function releaseCompactResize(page: Page) {
  await page.evaluate((ready) => window.dispatchEvent(new Event(ready)), RESIZE_READY);
}
