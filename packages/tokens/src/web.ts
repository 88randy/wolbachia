/**
 * Web-only tokens (supervisor, entomologist, promoter and admin screens).
 * Source: `design/web/source/web.css`; comparison in `docs/web-tokens-diff.md`.
 */
import type { ColorValue } from "./themes.ts";

/** Sidebar colors. The sidebar background is `color.chrome`. */
export interface SidebarColors {
  /** Text and icons on the sidebar. */
  readonly text: ColorValue;
  /** Hover and active item background. */
  readonly hover: ColorValue;
  /** Group headings ("Operación", ...) and the footer text. */
  readonly groupText: ColorValue;
}

/** Colors of the banners that sit above the page (offline, critical). */
export interface BannerColors {
  /** Text of the offline banner, on `color.navy`. */
  readonly offlineText: ColorValue;
}

/** Colors of the base map (MapLibre style). */
export interface MapColors {
  readonly land: ColorValue;
  readonly road: ColorValue;
  readonly block: ColorValue;
  readonly water: ColorValue;
}

/** Categorical chart series colors. */
export interface ChartColors {
  readonly 1: ColorValue;
  /**
   * PROVISIONAL: not part of the Codequim palette. Pending client approval
   * (issue #17, [PENDING]). Do not use outside charts.
   */
  readonly 2: ColorValue;
  readonly 3: ColorValue;
  /**
   * PROVISIONAL: not part of the Codequim palette. Pending client approval
   * (issue #17, [PENDING]). Do not use outside charts.
   */
  readonly 4: ColorValue;
}

/** Background of each entomological index band. */
export interface IndexBandColors {
  readonly optimal: ColorValue;
  /** New in the web design; not a status background. */
  readonly good: ColorValue;
  readonly alarm: ColorValue;
  readonly emergency: ColorValue;
}

/** Web-only colors of one theme. */
export interface WebThemeColors {
  readonly sidebar: SidebarColors;
  readonly banner: BannerColors;
  readonly map: MapColors;
  readonly chart: ChartColors;
  readonly band: IndexBandColors;
}

const lightWebColors: WebThemeColors = {
  sidebar: {
    text: "#C9D3EA",
    hover: "rgba(255, 255, 255, 0.12)",
    groupText: "#9EABC8",
  },
  banner: { offlineText: "#FFB547" },
  map: { land: "#EEF1EC", road: "#FFFFFF", block: "#E2E6DF", water: "#CFE0F2" },
  chart: { 1: "#1A5DFF", 2: "#D9620B", 3: "#0B6B35", 4: "#7A3CC4" },
  band: { optimal: "#E3F5EA", good: "#F1F8E6", alarm: "#FFF1D6", emergency: "#FDE8E8" },
};

const darkWebColors: WebThemeColors = {
  sidebar: {
    text: "#C9D3EA",
    hover: "rgba(255, 255, 255, 0.10)",
    groupText: "#9EABC8",
  },
  banner: { offlineText: "#FFB547" },
  map: { land: "#14254A", road: "#25396A", block: "#1B2E58", water: "#16335E" },
  chart: { 1: "#7FA4FF", 2: "#FFA25C", 3: "#5FD08F", 4: "#C9A2FF" },
  band: { optimal: "#123A2A", good: "#1A3424", alarm: "#3A2A0E", emergency: "#4A1A22" },
};

/** Interactive control heights in px. */
export interface ControlHeights {
  readonly sm: number;
  /** Default button height. */
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

/** Sizes of the app shell in px (`.sb`, `.sb.mini` and `.tp` in web.css). */
export interface ShellLayout {
  readonly sidebarWidth: number;
  readonly sidebarCollapsedWidth: number;
  readonly topBarHeight: number;
  /** Viewport width in px at or below which the sidebar stays collapsed (read in TypeScript: media queries cannot use variables). */
  readonly compactBreakpoint: number;
}

/** Web-only tokens. `light` and `dark` follow the same shape. */
export const web = {
  light: lightWebColors,
  dark: darkWebColors,
  control: { sm: 32, md: 36, lg: 40, xl: 44 } satisfies ControlHeights,
  /** Icon sizes in px: `.i` is 20, `.i.s16` and `.i.s24` in web.css. */
  icon: { sm: 16, md: 20, lg: 24 },
  layout: {
    sidebarWidth: 232,
    sidebarCollapsedWidth: 64,
    topBarHeight: 56,
    compactBreakpoint: 768,
  } satisfies ShellLayout,
  /**
   * Focus ring: solid line in `color.action` offset from the element, plus a soft halo
   * (`.fo` in web.css). The halo color is fixed in the design and does not change in dark.
   */
  focus: {
    ring: { width: 2, offset: 2, halo: { spread: 5, color: "rgba(26, 93, 255, 0.22)" } },
  },
  typography: {
    /** Page title (h1): 24/32 in the design. */
    titleFontSize: 24,
    titleLineHeight: 32,
    /** Body text size and line height. */
    bodyFontSize: 14,
    bodyLineHeight: 20,
    /** Labels, table headers and chips range from 12 to 13. */
    labelFontSize: 13,
    labelSmallFontSize: 12,
    /** No text is smaller than this. */
    minimumFontSize: 12,
  },
} as const;
