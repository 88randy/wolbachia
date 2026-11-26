// Colors are CSS variables set from packages/tokens by src/ui/theme-vars.ts, so light/dark follow the
// active theme and no hex value lives here.
const color = (name) => `var(--color-${name})`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        action: color("action"),
        "action-strong": color("action-strong"),
        "on-action": color("on-action"),
        navy: color("navy"),
        tint: color("tint"),
        bg: color("bg"),
        surface: color("surface"),
        "surface-muted": color("surface-muted"),
        ink: color("ink"),
        "ink-2": color("ink-2"),
        "ink-3": color("ink-3"),
        line: color("line"),
        "line-strong": color("line-strong"),
        success: color("success"),
        "success-bg": color("success-bg"),
        warning: color("warning"),
        "warning-bg": color("warning-bg"),
        danger: color("danger"),
        "danger-bg": color("danger-bg"),
        info: color("info"),
        "info-bg": color("info-bg"),
        neutral: color("neutral"),
        "neutral-bg": color("neutral-bg"),
      },
      borderRadius: { inner: "14px", card: "20px" },
    },
  },
  plugins: [],
};
