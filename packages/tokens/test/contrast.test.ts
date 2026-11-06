import assert from "node:assert/strict";
import { test } from "node:test";
import { darkTheme, lightTheme, web } from "../src/index.ts";

/** WCAG 2 relative luminance for opaque semantic color roles. */
function luminance(hex: string): number {
  const channels = hex.replace("#", "").match(/../g);
  assert.ok(channels?.length === 3, `Expected an opaque hex color: ${hex}`);
  const linear = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = linear;
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function assertContrast(
  pair: { foreground: string; background: string; label: string },
  minimum = 4.5,
) {
  const foreground = luminance(pair.foreground);
  const background = luminance(pair.background);
  const ratio =
    (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  assert.ok(ratio >= minimum, `${pair.label}: ${ratio.toFixed(2)}:1 < ${String(minimum)}:1`);
}

for (const [name, theme, colors] of [
  ["light", lightTheme, web.light],
  ["dark", darkTheme, web.dark],
] as const) {
  void test(`${name}: text remains readable on every shared surface`, () => {
    const surfaces = [
      theme.color.background,
      theme.color.surface,
      theme.color.surfaceMuted,
      theme.color.surfaceRaised,
    ];
    for (const [role, foreground] of Object.entries({
      ...theme.color.text,
      action: theme.color.action,
      actionStrong: theme.color.actionStrong,
    })) {
      for (const background of surfaces)
        assertContrast({ foreground, background, label: `${name} ${role}` });
    }
    for (const [role, pair] of Object.entries(theme.color.status)) {
      assertContrast({ foreground: pair.fg, background: pair.bg, label: `${name} ${role}` });
    }
    assertContrast({
      foreground: theme.color.onAction,
      background: theme.color.action,
      label: `${name} button`,
    });
    assertContrast({
      foreground: colors.sidebar.activeText,
      background: colors.sidebar.activeBackground,
      label: `${name} active navigation`,
    });
    for (const foreground of [colors.sidebar.text, colors.sidebar.groupText]) {
      assertContrast({
        foreground,
        background: theme.color.background,
        label: `${name} navigation`,
      });
    }
    for (const foreground of Object.values(colors.delta)) {
      assertContrast({ foreground, background: theme.color.surface, label: `${name} delta` });
    }
  });

  void test(`${name}: every button interaction state keeps AA text contrast`, () => {
    const variants = [
      { role: "primary", foreground: theme.color.onAction, base: theme.color.action },
      { role: "secondary", foreground: theme.color.actionStrong, base: theme.color.tint },
      { role: "tertiary", foreground: theme.color.text.primary, base: theme.color.surface },
      { role: "ghost", foreground: theme.color.text.secondary, base: theme.color.surface },
      {
        role: "destructiveTint",
        foreground: theme.color.status.critical.fg,
        base: theme.color.status.critical.bg,
      },
      {
        role: "dangerSolid",
        foreground: theme.color.onAction,
        base: theme.color.status.critical.fg,
      },
    ] as const;
    for (const { role, foreground, base } of variants) {
      for (const [state, background] of Object.entries({ base, ...colors.button[role] })) {
        assertContrast({ foreground, background, label: `${name} ${role} ${state}` });
      }
    }
    assertContrast({
      foreground: theme.color.text.secondary,
      background: theme.color.disabled.background,
      label: `${name} disabled button`,
    });
  });

  void test(`${name}: controls, focus and hovered scrollbars have visible edges`, () => {
    const controls = [theme.color.border.strong, theme.color.border.default, theme.color.action];
    for (const foreground of controls) {
      for (const background of [
        theme.color.surface,
        theme.color.surfaceRaised,
        theme.color.surfaceMuted,
        theme.color.background,
      ]) {
        assertContrast({ foreground, background, label: `${name} control` }, 3);
      }
    }
    for (const background of [
      colors.scrollbar.track,
      theme.color.surface,
      theme.color.surfaceMuted,
      theme.color.background,
    ]) {
      assertContrast(
        { foreground: colors.scrollbar.thumbHover, background, label: `${name} scrollbar` },
        3,
      );
    }
    assertContrast({
      foreground: colors.chart.axis,
      background: theme.color.surface,
      label: `${name} chart axis`,
    });
  });
}
