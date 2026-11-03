TITLE: [Repo] Phase 0: packages/tokens (Codequim) and packages/i18n (es-MX, en)
LABELS: repo,design,priority:high

## 1. Context
Mobile and web must not copy colors or copy text. The Codequim tokens are defined in `design/mobile/source/codequim.css`; the web design (`design/web/source/web.css`) uses the same palette plus a few web-only tokens (see `docs/web-tokens-diff.md`). All user-facing text must come from shared i18n keys.

## 2. Goal
Two shared packages that mobile and web consume: semantic design tokens with light and dark themes, and i18n message catalogs with shared keys.

## 3. Scope / Out of scope
**In:**
- `packages/tokens`: values from `codequim.css` (colors light + dark, type scale, radii, spacing base 8, shadow) under semantic names; web-only groups (sidebar, map, chart series, index bands, control heights, focus ring) in a separate `web` group; output as TypeScript constants usable by React Native and as CSS custom properties for web.
- `packages/i18n`: `es-MX` (default) and `en` catalogs, key naming convention (`area.screen.element`), a typed key list, the shared error and sync result codes (see `docs/api-conventions.md`), and a test that both languages have the same keys.
- README per package.

**Out:** the i18n runtime library of each app (chosen in #6 and #27); screen copy (lands with each screen).

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
- `@wolbachia/tokens`: `lightTheme`, `darkTheme`, `web` (web-only), plus a generated `tokens.css`.
- `@wolbachia/i18n`: `messages['es-MX']`, `messages.en`, `type MessageKey`.

## 6. Behavior
- A token value changes only in `packages/tokens`; apps never hard-code a color, radius or font size.
- A missing key in one language fails the test.

## 7. Edge cases & errors
- Dark theme: the web dark set must match the mobile dark set (verified 2026-11-03: shared values are identical).
- Chart colors #D9620B and #7A3CC4 are not in the Codequim palette: ship them as provisional `chart.2` / `chart.4` and keep the [PENDING] approval open.
- Text at 130 % (mobile) and +30 % length (web) must not need token changes.

## 8. Acceptance criteria
- [ ] Every value in `codequim.css` `:root` and `.dark` maps to a token (test compares them).
- [ ] Web-only tokens documented with their source in `docs/web-tokens-diff.md`.
- [ ] `es-MX` and `en` have the same keys (test).
- [ ] Both packages type-check and lint under #16 rules.

## Notes
[PENDING] Final approval of the chart colors and of the web radius/spacing snapping proposal (`docs/web-tokens-diff.md`). Defaults ship as documented until then.
