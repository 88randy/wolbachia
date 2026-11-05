/**
 * Icon outlines from the Codequim design (`design/mobile/source/*.dc.html`, the `<symbol>` sprites):
 * 24 x 24 viewBox, drawn with a 2.25 stroke, no fill. Add an icon here only when a screen uses it.
 * `settings` is the one icon not in the design (it has no entry point to P31 yet); it follows the same style.
 */
export const ICON_PATHS = {
  alert: "M12 3 2 20h20L12 3zM12 10v4M12 17v.5",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  check: "M5 12.5 10 17.5 19 7",
  cloudOk: "M7 19h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 10.5 4.25 4.25 0 0 0 7 19zM9 14.5l2 2 4-4",
  cloudUp:
    "M7 19h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 10.5 4.25 4.25 0 0 0 7 19zM12 16v-5M9.5 13.5 12 11l2.5 2.5",
  left: "M15 5l-7 7 7 7",
  noSignal: "M4 20v-3M9 20v-6M14 20v-4M19 20v-2M3 3l18 18M14 11V9M19 13V5",
  phone: "M7 3h10v18H7zM11 18h2",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15M21 20v-5h-5",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21",
} as const;

export type IconName = keyof typeof ICON_PATHS;
