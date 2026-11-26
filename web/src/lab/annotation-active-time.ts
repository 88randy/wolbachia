const ACTIVE_IDLE_MS = 60_000;
const MS_PER_SECOND = 1000;

/** Integrates only visible time in the 60 seconds following the latest interaction. */
export function createAnnotationActiveTime() {
  let elapsed = 0;
  let previous = Date.now();
  let lastInteraction = Number.NEGATIVE_INFINITY;
  let isVisible = document.visibilityState === "visible";
  const accrue = () => {
    const now = Date.now();
    if (isVisible)
      elapsed += Math.max(0, Math.min(now, lastInteraction + ACTIVE_IDLE_MS) - previous);
    previous = now;
  };
  return {
    interact: () => {
      accrue();
      lastInteraction = Date.now();
    },
    visibility: () => {
      accrue();
      isVisible = document.visibilityState === "visible";
    },
    read: () => {
      accrue();
      return Math.floor(elapsed / MS_PER_SECOND);
    },
  };
}
