/**
 * Semantic color themes (light and dark) derived from `design/mobile/source/codequim.css`.
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
  /** Persistent navigation chrome: mobile top bar and web sidebar. */
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
    background: "#F4F6FA",
    surface: "#FFFFFF",
    chrome: "#0A1A3F",
    emergency: "#C40F1E",
    text: { primary: "#0A1A3F", secondary: "#3A4664", tertiary: "#586380" },
    border: { default: "#C9D0DE", strong: "#7C869E", soft: "#E4E8EF" },
    disabled: { background: "#E4E8EF" },
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
    background: "#0B1630",
    surface: "#13244A",
    chrome: "#060E22",
    emergency: "#E0303F",
    text: { primary: "#F2F5FB", secondary: "#B7C1D6", tertiary: "#A3AFC8" },
    border: { default: "#2E4170", strong: "#8391B2", soft: "#1F3260" },
    disabled: { background: "#22345C" },
    status: {
      success: { fg: "#5FD08F", bg: "#123A2A" },
      warning: { fg: "#FFB547", bg: "#3A2A0E" },
      critical: { fg: "#FF8A8A", bg: "#4A1A22" },
      info: { fg: "#9DBBFF", bg: "#1C3266" },
      neutral: { fg: "#B7C1D6", bg: "#22345C" },
    },
  },
};
