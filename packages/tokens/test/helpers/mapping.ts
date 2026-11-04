/**
 * Old design-CSS custom property name (without `--`) -> token path.
 * This table is the documentation of where each Codequim value now lives.
 * Paths start at one of: `color`, `web`, `radius`, `shadow`, `mobileTypeScale`.
 */
import {
  darkTheme,
  formatShadow,
  lightTheme,
  mobileTypeScale,
  mobileTypeScale130,
  radius,
  shadow,
  web,
} from "../../src/index.ts";
import type { Theme, WebThemeColors } from "../../src/index.ts";
import { toCssValue } from "../../src/css.ts";
import { normalizeCssValue } from "./css-parser.ts";

/** Maps a design custom property name to a dotted token path. */
export type TokenMapping = Readonly<Record<string, string>>;

/** Properties that exist in both `codequim.css` and `web.css`. */
export const sharedMapping: TokenMapping = {
  brand: "color.brand",
  action: "color.action",
  strong: "color.actionStrong",
  navy: "color.navy",
  tint: "color.tint",
  bg: "color.background",
  surface: "color.surface",
  ink: "color.text.primary",
  ink2: "color.text.secondary",
  ink3: "color.text.tertiary",
  line: "color.border.default",
  "line-strong": "color.border.strong",
  "dis-bg": "color.disabled.background",
  "on-action": "color.onAction",
  ok: "color.status.success.fg",
  "ok-bg": "color.status.success.bg",
  warn: "color.status.warning.fg",
  "warn-bg": "color.status.warning.bg",
  crit: "color.status.critical.fg",
  "crit-bg": "color.status.critical.bg",
  info: "color.status.info.fg",
  "info-bg": "color.status.info.bg",
  neu: "color.status.neutral.fg",
  "neu-bg": "color.status.neutral.bg",
};

/** Properties only in `codequim.css`. */
export const mobileOnlyMapping: TokenMapping = {
  topbar: "color.chrome",
  emerg: "color.emergency",
  "fs-num": "mobileTypeScale.number",
  "fs-h1": "mobileTypeScale.h1",
  "fs-h2": "mobileTypeScale.h2",
  "fs-body": "mobileTypeScale.body",
  "fs-btn": "mobileTypeScale.button",
  "fs-lbl": "mobileTypeScale.label",
  "fs-cap": "mobileTypeScale.caption",
  "r-sm": "radius.sm",
  "r-md": "radius.md",
  "r-lg": "radius.lg",
  "r-xl": "radius.xl",
  "sh-1": "shadow.level1",
};

/** Same as the mobile type scale entries, pointing at the 130 % scale (`.x130`). */
export const mobileScale130Mapping: TokenMapping = Object.fromEntries(
  Object.entries(mobileOnlyMapping)
    .filter(([name]) => name.startsWith("fs-"))
    .map(([name, path]) => [name, path.replace("mobileTypeScale", "mobileTypeScale130")]),
);

/** Properties only in `web.css`. */
export const webOnlyMapping: TokenMapping = {
  "line-soft": "color.border.soft",
  side: "color.chrome",
  "side-ink": "web.sidebar.text",
  "side-hi": "web.sidebar.hover",
  "map-land": "web.map.land",
  "map-road": "web.map.road",
  "map-block": "web.map.block",
  "map-water": "web.map.water",
  c1: "web.chart.1",
  c2: "web.chart.2",
  c3: "web.chart.3",
  c4: "web.chart.4",
  "band-opt": "web.band.optimal",
  "band-good": "web.band.good",
  "band-alarm": "web.band.alarm",
  "band-emer": "web.band.emergency",
};

/** Everything a mapping path can point to for one theme. */
export function buildTokenContext(theme: Theme, webColors: WebThemeColors): object {
  return {
    color: theme.color,
    web: webColors,
    radius,
    shadow,
    mobileTypeScale,
    mobileTypeScale130,
  };
}

/** Context for the light theme. */
export const lightContext = buildTokenContext(lightTheme, web.light);

/** Context for the dark theme. */
export const darkContext = buildTokenContext(darkTheme, web.dark);

function walkPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (typeof node !== "object" || node === null || !(key in node)) {
      throw new Error(`Token path not found: ${path}`);
    }
    return Reflect.get(node, key);
  }, root);
}

function isShadowToken(value: unknown): value is Parameters<typeof formatShadow>[0] {
  return typeof value === "object" && value !== null && "blur" in value;
}

/** Resolves a token path to its normalized CSS value. */
export function resolveCssValue(context: object, path: string): string {
  const value = walkPath(context, path);
  if (isShadowToken(value)) {
    return normalizeCssValue(formatShadow(value));
  }
  if (typeof value === "string" || typeof value === "number") {
    return normalizeCssValue(toCssValue(value));
  }
  throw new Error(`Token path is not a leaf: ${path}`);
}
