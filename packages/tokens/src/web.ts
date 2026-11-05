/**
 * Web-only tokens (supervisor, entomologist, promoter and admin screens).
 * Source: issue #202 + approved preview; historical CSS comparison in `docs/web-tokens-diff.md`.
 */
import { darkTheme, lightTheme } from "./themes.ts";
import type { ColorValue } from "./themes.ts";

/** Sidebar colors. The sidebar sits on `color.background`. */
export interface SidebarColors {
  /** Text and icons on the sidebar. */
  readonly text: ColorValue;
  /** Hover and active item background. */
  readonly hover: ColorValue;
  /** Group headings ("Operación", ...) and the footer text. */
  readonly groupText: ColorValue;
  readonly activeBackground: ColorValue;
  readonly activeText: ColorValue;
  readonly treeLine: ColorValue;
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
  readonly grid: ColorValue;
  readonly axis: ColorValue;
  readonly tooltip: ColorValue;
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
  readonly overlay: { readonly backdrop: ColorValue };
  readonly banner: BannerColors;
  readonly map: MapColors;
  readonly chart: ChartColors;
  readonly band: IndexBandColors;
  readonly delta: {
    readonly positive: ColorValue;
    readonly negative: ColorValue;
    readonly neutral: ColorValue;
  };
  readonly scrollbar: {
    readonly track: ColorValue;
    readonly thumb: ColorValue;
    readonly thumbHover: ColorValue;
  };
}

const lightWebColors: WebThemeColors = {
  sidebar: {
    text: "#4B5563",
    hover: "#F1F3F5",
    groupText: "#596470",
    activeBackground: "#FFFFFF",
    activeText: "#20252D",
    treeLine: "#C5CDD5",
  },
  banner: { offlineText: "#FFB547" },
  overlay: { backdrop: "rgba(12, 20, 32, 0.42)" },
  map: { land: "#EEF1EC", road: "#FFFFFF", block: "#E2E6DF", water: "#CFE0F2" },
  chart: {
    1: lightTheme.color.action,
    2: "#B85C25",
    3: "#6D7885",
    4: "#7A3CC4",
    grid: "#DDE2E7",
    axis: "#596470",
    tooltip: "#FFFFFF",
  },
  delta: { positive: "#147044", negative: "#AD3D2F", neutral: "#596470" },
  scrollbar: { track: "#EEF0F2", thumb: "#BCC3CB", thumbHover: "#6D7885" },
  band: { optimal: "#E3F5EA", good: "#F1F8E6", alarm: "#FFF1D6", emergency: "#FDE8E8" },
};

const darkWebColors: WebThemeColors = {
  sidebar: {
    text: "#CBD1D8",
    hover: "#2B3038",
    groupText: "#AFB8C3",
    activeBackground: "#303640",
    activeText: "#F1F3F5",
    treeLine: "#596470",
  },
  banner: { offlineText: "#FFB547" },
  overlay: { backdrop: "rgba(12, 20, 32, 0.42)" },
  map: { land: "#14254A", road: "#25396A", block: "#1B2E58", water: "#16335E" },
  chart: {
    1: darkTheme.color.action,
    2: "#E9A56F",
    3: "#AFB8C3",
    4: "#C9A2FF",
    grid: "#3B424D",
    axis: "#AFB8C3",
    tooltip: "#303640",
  },
  delta: { positive: "#79D5A0", negative: "#FFAC9E", neutral: "#AFB8C3" },
  scrollbar: { track: "#181B20", thumb: "#58636F", thumbHover: "#929DAA" },
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
  readonly sidebarMinWidth: number;
  readonly sidebarMaxWidth: number;
  readonly sidebarResizeStep: number;
  readonly scrollbarSize: number;
  readonly wideBreakpoint: number;
  readonly kpiMinWidth: number;
  readonly rightRailWidth: number;
  readonly commandPaletteWidth: number;
  readonly userMenuWidth: number;
  readonly searchMaxWidth: number;
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
    sidebarWidth: 248,
    sidebarMinWidth: 200,
    sidebarMaxWidth: 360,
    sidebarResizeStep: 16,
    scrollbarSize: 6,
    wideBreakpoint: 1280,
    kpiMinWidth: 144,
    rightRailWidth: 300,
    commandPaletteWidth: 600,
    userMenuWidth: 300,
    searchMaxWidth: 512,
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
  motion: { fast: "150ms", normal: "200ms", easing: "ease-out", exitEasing: "ease-in" },
  chartGeometry: {
    width: 640,
    height: 240,
    miniHeight: 144,
    padding: 32,
    lineWidth: 1.5,
    markerSize: 3,
    barRadius: 4,
    tooltipWidth: 184,
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
    kpiValueFontSize: 28,
    kpiValueLineHeight: 34,
    monoLabelFontSize: 12,
    monoLetterSpacing: "0.06em",
    captionFontSize: 12,
  },
} as const;
