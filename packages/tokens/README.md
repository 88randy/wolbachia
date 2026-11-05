# @wolbachia/tokens

Codequim design tokens shared by `mobile/` and `web/`. A token value changes **only here**; apps never hard-code a color, radius, spacing or font size.

Visual source of truth: issue #202 + the owner-approved style preview (approval pending). `design/mobile/source/codequim.css` and `design/web/source/web.css` preserve history. `docs/web-tokens-diff.md` records values, contrast ratios and decisions.

## Structure

TypeScript source, consumed directly (no build step): `main` is `src/index.ts`. Metro and the web bundler compile it with the app. Imports inside the package carry the `.ts` extension so Node can also run the files without a compiler.

| Export | What |
|---|---|
| `lightTheme`, `darkTheme` | Same shape: `{ color }`. Semantic names. |
| `radius` | `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `full` |
| `spacing` | Base 8, key = multiple of the base (`spacing[0.5]` = 4 px, `spacing[1]` = 8 px ... `spacing[6]` = 48 px) |
| `mobileTypeScale`, `mobileTypeScale130` | Mobile font sizes at 100 % and 130 % text |
| `font` | Inter plus `font.mono` (JetBrains Mono family + CSS stack), tabular figures |
| `shadow`, `formatShadow` | `level1`, diffuse `card` and `overlay`; structured React Native-compatible tokens and CSS form |
| `web` | Web-only: `web.light` / `web.dark` (sidebar, banner, map, chart, band), `web.control`, `web.icon` (16 / 20 / 24), `web.layout` (shell sizes), `web.focus`, `web.typography` |

Color roles (`theme.color`): `brand`, `action`, `actionStrong`, `onAction`, `navy`, `tint`, `background`, `surface`, `surfaceMuted`, `surfaceRaised`, `chrome`, `emergency`, `text.{primary,secondary,tertiary}`, `border.{default,strong,soft}`, `disabled.background`, `status.{success,warning,critical,info,neutral}.{fg,bg}`.

- `background` is the canvas. `chrome` stays unchanged for the mobile top bar (`--topbar`); web navigation uses the canvas.
- `actionStrong` and `status.info.fg` share a value today but are separate roles on purpose.
- `web.*.sidebar` defines text, hover, active background/text and tree lines. The soft border is decorative; inputs use the AA-tested `border.default`.

### Where the values come from

The original colors and scales came from design CSS. Issue #202 replaces value equality with historical variable-name coverage: every old variable still resolves to an existing semantic token. `web.control`, `web.layout`, `web.icon`, `web.focus`, `web.typography`, `web.*.banner`, the sidebar `groupText` role, `radius.xs`, `radius.full` and `spacing` come from the approved proposal in `docs/web-tokens-diff.md` (section 4), not from CSS variables, so that test does not cover them.

Mobile compact components use `mobileLayout.compactGap` (6 dp from design P28); `radius.full` draws pills.

### Provisional chart colors

`web.*.chart[2]` (#B85C25 light, #E9A56F dark) and `web.*.chart[4]` (#7A3CC4, #C9A2FF) are **not in the Codequim palette**. They ship as provisional until the client approves or replaces them ([PENDING] in issue #17). Use them only for chart series.

### Old name -> token

The mapping table lives in `test/helpers/mapping.ts` and the tests fail if a historical CSS variable has no valid token mapping. Summary: `ink/ink2/ink3` -> `color.text.*`, `line/line-strong/line-soft` -> `color.border.*`, `bg` -> `color.background`, `strong` -> `color.actionStrong`, `dis-bg` -> `color.disabled.background`, `ok/warn/crit/info/neu(+ -bg)` -> `color.status.*`, `topbar` and `side` -> `color.chrome`, `emerg` -> `color.emergency`, `fs-*` -> `mobileTypeScale.*`, `r-*` -> `radius.*`, `sh-1` -> `shadow.level1`.

## Use

**React Native (mobile)**

```ts
import { darkTheme, lightTheme, mobileTypeScale, radius, spacing } from '@wolbachia/tokens';

const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
const cardStyle = { backgroundColor: theme.color.surface, borderRadius: radius.md, padding: spacing[2] };
```

Pick `mobileTypeScale130` when the user enables enlarged text. Do not use `web`.

**Web (React)**

Import the generated stylesheet once and use the variables, or import the TypeScript values (for charts and the map style):

```ts
import '@wolbachia/tokens/tokens.css';
import { web } from '@wolbachia/tokens';
```

```css
.card { background: var(--color-surface); border-radius: var(--radius-md); }
```

Light is the default (`:root`). Set `data-theme="dark"` on `<html>` (or any ancestor) for the dark theme. Variable names: `--color-<role>`, `--web-<group>-<name>`, `--radius-<step>`, `--space-<multiple>` (`--space-0-5` = 4 px), `--shadow-level-1`, `--web-control-*`, `--web-icon-*`, `--web-layout-*` (`compact-breakpoint` 768 is for TypeScript, `useCompactViewport`; `sidebar-width` 248, `sidebar-collapsed-width` 64, `top-bar-height` 56), `--web-focus-ring-*` (width, offset, halo spread and color), `--web-type-*`, `--font-family`. The mobile type scale is not in the CSS.

## Generate the CSS

```
npm run build:css      # writes dist/tokens.css from src/
```

`dist/tokens.css` is **generated and not committed** (`dist/` is gitignored). One source of truth, no stale copy. The `dev`, `build` and `test` scripts of `web/` run `build:css` first (issue #26). The generator is a plain Node script run with `--experimental-strip-types` (Node >= 22.6; verified on 22.13), so there are no runtime or build dependencies.

## Develop

```
npm install
npm run typecheck      # tsc --noEmit
npm test               # node:test
```

Tests: every historical property in `codequim.css` (`:root`, `.dark`, `.x130`) and `web.css` (`:root`, `.dark`) maps to an existing token; light and dark have identical keys; the 130 % scale equals the default scale times 1.3; the generated CSS contains the expected variables.

To add a token: add it to light **and** dark (the type forces it), add its design CSS name to the mapping table if one exists, update `docs/web-tokens-diff.md`.

## Visual refresh #202

Existing exports and semantic role names remain available. New roles:

- `color.surfaceMuted` for quiet widget bodies and skeletons;
  `color.surfaceRaised` for their nested cards.
- `radius.card` 20 and `radius.inner` 14; `shadow.card` / `shadow.overlay`.
  `shadow.level1` and the `ShadowToken` shape remain native-compatible.
- `font.mono.{family,cssStack}` generates `--font-family-mono`.
- `web.*.delta`, `web.*.scrollbar`, `web.*.overlay.backdrop`,
  `web.*.chart.{grid,axis,tooltip}` and sidebar active/tree roles.
- `web.motion.{fast,normal,easing,exitEasing}` generates CSS strings (`150ms`,
  `200ms`), never lengths. Reduced-motion behavior belongs to consumer CSS.
- `web.layout` adds sidebar min/max/step, scrollbar size and wide breakpoint.
- `web.typography` adds KPI 28/34, mono labels/captions 12 and `0.06em` tracking.
- `web.chartGeometry` supplies SVG dimensions, marker/bar radii and tooltip size;
  CSS names start with `--web-chart-geometry-*`.

The Codequim blue `color.action` is the primary accent. Chart series 1 references
that role, so an owner-approved accent change has one semantic edit per theme.
`background` is the canvas; no redundant `canvas` alias is introduced.

`test/contrast.test.ts` computes WCAG luminance and tests all text/link roles on
all shared surfaces, status pairs, deltas, sidebar active states, input/strong
borders, focus and hovered scrollbars in both themes. Minimums are 4.5:1 for text
and 3:1 for UI. See `docs/web-tokens-diff.md` for measured ratios and D1–D7.
