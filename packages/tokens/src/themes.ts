/**
 * Semantic color themes (light and dark) refreshed by issue #202; historical design CSS preserves the original palette.
 * Names describe the role of a color, never its hue. Two roles that share a value
 * today (`actionStrong` and `status.info.fg`) stay separate so one can change alone.
 */

/** A hex color (`#RRGGBB`) or an `rgba(...)` string. */
export type ColorValue = string;

/** Foreground and background pair of a status (badge, notice, banner). */
export interface StatusColors {
  readonly fg: ColorValue;
  readonly bg: ColorValue;
}

/** Every color role of a theme. Light and dark themes have exactly this shape. */
export interface ThemeColors {
  /** Brand blue, for logos and large brand surfaces. */
  readonly brand: ColorValue;
  /** Primary interactive color (buttons, links, focus ring). */
  readonly action: ColorValue;
  /** High-contrast variant of the action color. */
  readonly actionStrong: ColorValue;
  /** Content drawn on top of `action`. */
  readonly onAction: ColorValue;
  /** Deep navy brand color; the same in both themes. */
  readonly navy: ColorValue;
  /** Light tint of the brand blue (selected rows, soft highlights). */
  readonly tint: ColorValue;
  /** Page background. */
  readonly background: ColorValue;
  /** Cards, sheets and any raised surface. */
  readonly surface: ColorValue;
  /** Nested raised content within a muted card. */
  readonly surfaceRaised: ColorValue;
  /** Quiet widget bodies, table hover and skeleton base. */
  readonly surfaceMuted: ColorValue;
  /** Historical mobile top-bar chrome; web navigation now uses the canvas. */
  readonly chrome: ColorValue;
  /** Emergency button and emergency-only emphasis. */
  readonly emergency: ColorValue;
  readonly text: {
    readonly primary: ColorValue;
    readonly secondary: ColorValue;
    readonly tertiary: ColorValue;
  };
  readonly border: {
    readonly default: ColorValue;
    readonly strong: ColorValue;
    readonly soft: ColorValue;
  };
  readonly disabled: {
    readonly background: ColorValue;
  };
  readonly status: {
    readonly success: StatusColors;
    readonly warning: StatusColors;
    readonly critical: StatusColors;
    readonly info: StatusColors;
    readonly neutral: StatusColors;
  };
}

/** A complete theme. */
export interface Theme {
  readonly color: ThemeColors;
}

/** Codequim light theme. */
export const lightTheme: Theme = {
  color: {
    brand: "#3772FF",
    action: "#1A5DFF",
    actionStrong: "#0044E6",
    onAction: "#FFFFFF",
    navy: "#0A1A3F",
    tint: "#EBF1FF",
    background: "#EEF0F2",
    surface: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#F1F3F5",
    chrome: "#0A1A3F",
    emergency: "#C40F1E",
    text: { primary: "#20252D", secondary: "#4B5563", tertiary: "#596470" },
    border: { default: "#7A8490", strong: "#737D88", soft: "#DDE2E7" },
    disabled: { background: "#E8ECEF" },
    status: {
      success: { fg: "#0B6B35", bg: "#E3F5EA" },
      warning: { fg: "#8A4B00", bg: "#FFF1D6" },
      critical: { fg: "#B3141A", bg: "#FDE8E8" },
      info: { fg: "#0044E6", bg: "#EBF1FF" },
      neutral: { fg: "#3A4664", bg: "#EEF0F5" },
    },
  },
};

/** Codequim dark theme. Same shape as {@link lightTheme}. */
export const darkTheme: Theme = {
  color: {
    brand: "#3772FF",
    action: "#7FA4FF",
    actionStrong: "#9DBBFF",
    onAction: "#0A1A3F",
    navy: "#0A1A3F",
    tint: "#1C3266",
    background: "#181B20",
    surface: "#22262D",
    surfaceRaised: "#303640",
    surfaceMuted: "#2B3038",
    chrome: "#060E22",
    emergency: "#E0303F",
    text: { primary: "#F1F3F5", secondary: "#CBD1D8", tertiary: "#AFB8C3" },
    border: { default: "#7E8997", strong: "#929DAA", soft: "#3B424D" },
    disabled: { background: "#2B3038" },
    status: {
      success: { fg: "#5FD08F", bg: "#123A2A" },
      warning: { fg: "#FFB547", bg: "#3A2A0E" },
      critical: { fg: "#FF8A8A", bg: "#4A1A22" },
      info: { fg: "#9DBBFF", bg: "#1C3266" },
      neutral: { fg: "#CBD1D8", bg: "#303640" },
    },
  },
};
