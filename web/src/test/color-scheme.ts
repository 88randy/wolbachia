import { vi } from "vitest";

/** A controllable system color scheme with event-driven changes. */
export function stubColorScheme(isDark: boolean) {
  const query = Object.assign(new EventTarget(), {
    matches: isDark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
  });
  vi.stubGlobal("matchMedia", (media: string) =>
    media === query.media
      ? query
      : Object.assign(new EventTarget(), { matches: false, media, onchange: null }),
  );
  return {
    setDark(next: boolean) {
      query.matches = next;
      query.dispatchEvent(new Event("change"));
    },
  };
}
