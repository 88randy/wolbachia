# @wolbachia/tokens

Codequim design tokens shared by `mobile/` and `web/`. A token value changes **only here**; apps never hard-code a color, radius, spacing or font size.

Sources: `design/mobile/source/codequim.css` (baseline), `design/web/source/web.css` (web-only values), `docs/web-tokens-diff.md` (comparison and decisions). Issue: #17.

## Structure

TypeScript source, consumed directly (no build step): `main` is `src/index.ts`. Metro and the web bundler compile it with the app. Imports inside the package carry the `.ts` extension so Node can also run the files without a compiler.

| Export | What |
|---|---|
| `lightTheme`, `darkTheme` | Same shape: `{ color }`. Semantic names. |
| `radius` | `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 20`, `full` |
| `spacing` | Base 8, key = multiple of the base (`spacing[0.5]` = 4 px, `spacing[1]` = 8 px ... `spacing[6]` = 48 px) |
| `mobileTypeScale`, `mobileTypeScale130` | Mobile font sizes at 100 % and 130 % text |
| `font` | Inter, CSS stack, tabular figures |
| `shadow`, `formatShadow` | Elevation as a structured token and its CSS form |
| `web` | Web-only: `web.light` / `web.dark` (sidebar, banner, map, chart, band), `web.control`, `web.icon` (16 / 20 / 24), `web.layout` (shell sizes), `web.focus`, `web.typography` |

Color roles (`theme.color`): `brand`, `action`, `actionStrong`, `onAction`, `navy`, `tint`, `background`, `surface`, `chrome`, `emergency`, `text.{primary,secondary,tertiary}`, `border.{default,strong,soft}`, `disabled.background`, `status.{success,warning,critical,info,neutral}.{fg,bg}`.

- `chrome` is the navigation chrome: mobile top bar (`--topbar`) and web sidebar (`--side`).
- `actionStrong` and `status.info.fg` share a value today but are separate roles on purpose.
- Web sidebar background is `color.chrome`; the soft border is `color.border.soft`.

### Where the values come from

Colors, the mobile type scale, `radius.sm`..`xl` and `shadow` come from the design CSS variables, and the design-CSS test compares them. `web.control`, `web.layout`, `web.icon`, `web.focus`, `web.typography`, `web.*.banner`, the sidebar `groupText` role, `radius.xs`, `radius.full` and `spacing` come from the approved proposal in `docs/web-tokens-diff.md` (section 4), not from CSS variables, so that test does not cover them.

Mobile compact components use `mobileLayout.compactGap` (6 dp from design P28); `radius.full` draws pills.

### Provisional chart colors

`web.*.chart[2]` (#D9620B light, #FFA25C dark) and `web.*.chart[4]` (#7A3CC4, #C9A2FF) are **not in the Codequim palette**. They ship as provisional until the client approves or replaces them ([PENDING] in issue #17). Use them only for chart series.

### Old name -> token

The mapping table lives in `test/helpers/mapping.ts` and the tests fail if a value in the design CSS drifts from the token. Summary: `ink/ink2/ink3` -> `color.text.*`, `line/line-strong/line-soft` -> `color.border.*`, `bg` -> `color.background`, `strong` -> `color.actionStrong`, `dis-bg` -> `color.disabled.background`, `ok/warn/crit/info/neu(+ -bg)` -> `color.status.*`, `topbar` and `side` -> `color.chrome`, `emerg` -> `color.emergency`, `fs-*` -> `mobileTypeScale.*`, `r-*` -> `radius.*`, `sh-1` -> `shadow.level1`.

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

Light is the default (`:root`). Set `data-theme="dark"` on `<html>` (or any ancestor) for the dark theme. Variable names: `--color-<role>`, `--web-<group>-<name>`, `--radius-<step>`, `--space-<multiple>` (`--space-0-5` = 4 px), `--shadow-level-1`, `--web-control-*`, `--web-icon-*`, `--web-layout-*` (`compact-breakpoint` 768 is for TypeScript, `useCompactViewport`; `sidebar-width` 232, `sidebar-collapsed-width` 64, `top-bar-height` 56), `--web-focus-ring-*` (width, offset, halo spread and color), `--web-type-*`, `--font-family`. The mobile type scale is not in the CSS.

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

Tests: every property in `codequim.css` (`:root`, `.dark`, `.x130`) and `web.css` (`:root`, `.dark`) maps to a token with the same value; light and dark have identical keys; the 130 % scale equals the default scale times 1.3; the generated CSS contains the expected variables.

To add a token: add it to light **and** dark (the type forces it), add its design CSS name to the mapping table if one exists, update `docs/web-tokens-diff.md`.
