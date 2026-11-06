# Design tokens: web design vs Codequim (mobile)

Compared on 2026-11-03 by parsing the `:root` and `.dark` custom properties of `design/mobile/source/codequim.css` (baseline) and `design/web/source/web.css`. Implementation: `packages/tokens` (#17).

## 1. Shared tokens — identical

Every custom property present in both files has the same value, in light and in dark:
brand, action, strong, navy, tint, bg, surface, ink, ink2, ink3, line, line-strong, dis-bg, on-action, ok / ok-bg, warn / warn-bg, crit / crit-bg, info / info-bg, neu / neu-bg.
Typography: Inter with tabular figures in both.

## 2. Mobile only (kept in `packages/tokens`; the web can ignore them)

| Token | Value (light / dark) | Note |
|---|---|---|
| `--emerg` | #C40F1E / #E0303F | emergency button |
| `--topbar` | #0A1A3F / #060E22 | same values as the web sidebar (`--side`) → one semantic token `chrome` |
| `--fs-*` | num 40, h1 24, h2 20, body 16, btn 17, lbl 14, cap 13 | mobile type scale; `.x130` scales it to 130 % |
| `--r-sm/md/lg/xl` | 8 / 12 / 16 / 20 | radius scale shared with web |
| `--sh-1` | 0 1px 2px rgba(10,26,63,.08) | elevation |

## 3. Web only (a `web` group in `packages/tokens`)

| Group | Light | Dark | Note |
|---|---|---|---|
| Soft border | `--line-soft` #E4E8EF | #1F3260 | same light value as `--dis-bg` |
| Sidebar | `--side` #0A1A3F, `--side-ink` #C9D3EA, `--side-hi` rgba(255,255,255,.12) | `--side` #060E22, `--side-hi` rgba(255,255,255,.10) | `--side` = mobile `--topbar` |
| Sidebar group heading (#26) | `#9EABC8` (`.sb .grp`) | same | new role `sidebar.groupText` |
| Offline banner (#26) | text `#FFB547` on `color.navy` (state board) | same | new role `banner.offlineText`; same value as the dark warning foreground, used in both themes because the band is always navy |
| Map | land #EEF1EC, road #FFFFFF, block #E2E6DF, water #CFE0F2 | #14254A, #25396A, #1B2E58, #16335E | MapLibre style |
| Chart series | c1 #1A5DFF, c2 #D9620B, c3 #0B6B35, c4 #7A3CC4 | #7FA4FF, #FFA25C, #5FD08F, #C9A2FF | **c2 and c4 are not in the Codequim palette**: provisional, [PENDING] approval |
| Index bands | opt #E3F5EA, good #F1F8E6, alarm #FFF1D6, emer #FDE8E8 | #123A2A, #1A3424, #3A2A0E, #4A1A22 | opt/alarm/emer reuse status backgrounds; `good` is new |

## 4. Not tokens yet in the web design (proposal for #17)

- **Radius:** keep the shared scale 8 / 12 / 16 / 20 and add `xs = 4` for small controls. Web one-offs snap: 10 → 8 (notices, toasts) or 12 (frame), 14 → 16, 15 → full (pill).
- **Spacing:** base 8 with a 4 px half step; 6 → 4 or 8, 10 → 8 or 12, 14 → 12 or 16, 18 → 16 or 20.
- **Type (web):** page title 24/32 (`titleFontSize`, added in #26), body 14/20, labels 12–13, minimum 12 px (some chips and chart labels use 10–11 px in the design; raise them).
- **Control heights:** 32 / 36 / 40 / 44 px (button default 36) → `control.sm/md/lg/xl`.
- **Icon sizes (#26):** 16 / 20 / 24 (`.i.s16`, `.i`, `.i.s24`) → `web.icon.{sm,md,lg}` → `--web-icon-*`.
- **Compact breakpoint (#26):** 768 px, new: below it the sidebar stays collapsed (WCAG 1.4.10 reflow at 320 px) -> `web.layout.compactBreakpoint`.
- **Shell sizes (#26):** sidebar 232, collapsed sidebar 64, top bar 56 (`.sb`, `.sb.mini`, `.tp`) → `web.layout.{sidebarWidth,sidebarCollapsedWidth,topBarHeight}` → `--web-layout-*`.
- **Focus ring:** 2 px solid `action`, 2 px offset, plus a `0 0 0 5px rgba(26,93,255,.22)` halo (`.fo` in `web.css`) → `web.focus.ring.{width,offset,halo}`.

## 5. Decisions

1. Structure: semantic names (`color.text.primary`, `color.status.success.bg`, …) generated from the Codequim values. Accepted with the plan of 2026-11-03.
2. Aliases: one semantic token per role (`strong` and `info` share a value but stay separate roles). Accepted.
3. Chart colors c2 / c4: **[PENDING]** client approval; provisional until then.
4. Radius and spacing snapping above: proposal, applied in #17 unless the client objects.

## Visual refresh #202

Issue #202 and the owner-approved preview are the visual source of truth (decision
118). **The owner approved Step 1**; Step 2 now applies the shared look to existing screens, with the owner-requested single top-bar theme switch. Visual/e2e execution remains a CI/review check. Sections 1–5 above record the
historical comparison. `design/mobile/source/codequim.css` and
`design/web/source/web.css` stay unchanged as history. The design-CSS test retains
complete variable-name-to-token coverage, not equality with historical values.

### Palette and contrast

`background` is the cool canvas; a separate `canvas` alias would duplicate its
role. `surface` is the main card, `surfaceMuted` a quiet widget body, and
`surfaceRaised` the nested card. Web navigation sits on `background`; `chrome`
remains unchanged for the mobile top bar. Hairlines separate related content;
input borders use `border.default`, not the decorative `border.soft`.

| Role | Previous light / dark | New light / dark |
|---|---|---|
| `background` | #F4F6FA / #0B1630 | #EEF0F2 / #181B20 |
| `surface` | #FFFFFF / #13244A | #FFFFFF / #22262D |
| `surfaceMuted` | — | #F1F3F5 / #2B3038 |
| `surfaceRaised` | — | #FFFFFF / #303640 |
| `text.primary` | #0A1A3F / #F2F5FB | #20252D / #F1F3F5 |
| `text.secondary` | #3A4664 / #B7C1D6 | #4B5563 / #CBD1D8 |
| `text.tertiary` | #586380 / #A3AFC8 | #596470 / #AFB8C3 |
| `border.default` | #C9D0DE / #2E4170 | #7A8490 / #7E8997 |
| `border.strong` | #7C869E / #8391B2 | #737D88 / #929DAA |
| `border.soft` | #E4E8EF / #1F3260 | #DDE2E7 / #3B424D |
| Sidebar text | #C9D3EA / #C9D3EA | #4B5563 / #CBD1D8 |
| Sidebar active bg / text | historical translucent navy chrome | #FFFFFF / #20252D (light), #303640 / #F1F3F5 (dark) |
| Chart series 1 | #1A5DFF / #7FA4FF | unchanged, references `action` directly |
| Chart series 2 | #D9620B / #FFA25C | #B85C25 / #E9A56F |
| Chart context series 3 | #0B6B35 / #5FD08F | #6D7885 / #AFB8C3 |
| Positive delta | — | #147044 / #79D5A0 |
| Negative delta | — | #AD3D2F / #FFAC9E |
| Scrollbar track | — | #EEF0F2 / #181B20 |
| Scrollbar thumb / hover | — | #BCC3CB / #6D7885 (light), #58636F / #929DAA (dark) |

The Codequim blue `action` stays the single primary accent (D2). The owner may
change it at preview time: edit the semantic theme role once; chart series 1
references it. Warm orange is chart series 2 and warning emphasis. Series 2 and 4
remain **PROVISIONAL**, pending client palette approval (#17). Map and index band
colors retain their domain meaning.

WCAG relative-luminance ratios (unrounded values are asserted in
`packages/tokens/test/contrast.test.ts`):

| Foreground / background | Light | Dark |
|---|---:|---:|
| Primary / surface | 15.40:1 | 13.65:1 |
| Secondary / surface | 7.56:1 | 9.87:1 |
| Tertiary / surface | 6.03:1 | 7.57:1 |
| Weakest text across background, surface, muted and raised | 5.28:1 | 6.06:1 |
| Action link / weakest shared surface | 4.53:1 | 5.01:1 |
| Status success fg / bg | 5.84:1 | 6.55:1 |
| Status warning fg / bg | 6.09:1 | 7.88:1 |
| Status critical fg / bg | 5.90:1 | 6.33:1 |
| Status info fg / bg | 6.25:1 | 6.47:1 |
| Status neutral fg / bg | 8.22:1 | 7.90:1 |
| Positive / negative delta on surface | 6.12 / 6.03:1 | 8.56 / 8.42:1 |
| Sidebar active text / active background | 15.40:1 | 10.93:1 |
| Strong border / surface | 4.18:1 | 5.51:1 |
| Input border / surface | 3.80:1 | 4.27:1 |
| Scrollbar thumb hover / track | 3.93:1 | 6.27:1 |
| Scrollbar thumb hover / surface | 4.49:1 | 5.51:1 |

### Scales and interaction decisions

- D1: Inter remains the UI font. Self-hosted JetBrains Mono latin 400/500 supplies
  numbers, dates, codes, headers and pills through `font.mono` and
  `--font-family-mono`; neither font uses a CDN.
- Radius: existing scale retained; `card=20`, `inner=14`, `full=9999`. Shadows:
  `level1` keeps its React Native shape; `card` is `0 8px 32px rgba(20,30,40,.04)`;
  `overlay` is `0 16px 48px rgba(12,20,32,.14)`. In dark mode these diffuse shadows
  are nearly invisible; semantic borders carry the edges.
- KPI type is 28/34; mono labels and captions are 12 px with `0.06em` header
  spacing. No minimum type size changed. Base spacing remains the 8 px grid.
- D3: Radix unstyled primitives and cmdk share accessible overlay behavior.
  Existing native-dialog screen logic stays intact; Step 2 uses the shared dialog appearance.
- D4: in-house pixel splitter: default 248, min 200, max 360, collapsed 64, keyboard
  step 16 px. Compact breakpoint remains 768; wide rail breakpoint is 1280.
- D5: one token-driven 6 px scrollbar, standard thin scrollbar plus Safari
  fallback; hover/focus uses the tested stronger thumb.
- Motion: 150 ms fast, 200 ms normal, ease-out entry and ease-in exit; consumers
  animate opacity/transform only and disable animation for reduced motion.
- D6: no native alert/confirm/prompt; ESLint `no-alert` is an error for web.
- D7: dev-only `/harness/style-preview.html`, with `?theme=dark` and `?lang=en`;
  no production route. The owner approved Step 1 and authorized Step 2.

### Approved rollout audit (Step 2)

The owner approved the Step 1 preview and authorized the existing-screen rollout.
Decision **118** applies; no API, permission, query, mutation or draft contract changes.

| Area | Shared presentation applied / retained |
|---|---|
| Shell | One top-bar sun/moon switch; System follows live OS appearance until the first explicit choice. Sidebar keeps its user menu and collapse control. |
| Login, forgot/reset password, organization selection | AuthLayout uses Card; brand panel, canvas and form surfaces use both theme palettes. Existing field validation and submission flow remain. |
| Phones | Existing FilterBar/DataTable supply loading, error, empty and table surfaces; PhoneStatusBadge uses StatusPill. |
| Rule parameters | Initial CardSkeleton; summary, new-version form and history Cards; history DataTable embedded in its Card; StatusPill/Button; failed refresh keeps existing data and draft with an inline Retry notice. |
| Catalogs | Shaped initial skeleton; scoped EmptyState/ErrorState and refresh notice; StatusPill/Button. Empty index offers Retry because no create-catalog API exists. Permission-gated item creation stays intact. |
| Fleet | Shared Card/EmptyState/ErrorState and initial skeleton; StatusPill/Button; record summaries retain void reason/author and all permission guards. |
| States and void | Shared Cards and actionable error/empty states; native dialog styling retained. Void confirmation initially focuses Cancel; invalid selection still receives focus after submit. |
| Preview | Unbroken pills/relative times; visible named row actions; a one-row title/actions/period header; labeled size/state button matrices; two-column compact and one-column narrow KPI layout. Wide content scrolls in named, keyboard-scrollable regions. |

Definition-of-done exceptions: existing native dialogs and existing form/draft
logic are retained as explicitly requested; existing reversible deactivation
confirmation is not redesigned into an Undo flow in this visual-only rollout.
Configuration errors describe repairing build configuration rather than offering
a Retry that cannot fix it. The owner-requested top-bar theme switch supersedes
the skill's footer placement. No new optimistic mutations or screen features
are introduced. Contrast, keyboard/state regressions and tokens-only styling
are automated checks; rendered light/dark screenshots, 320/390/768/1280/1440 px
geometry, 200% zoom and +30% text remain visual review checks, not assertions
that a jsdom test can establish. Playwright is reserved for CI in this task.

Integration compatibility: the geography block-column helper now accepts i18next's concrete TFunction type instead of expanding ReturnType of the generic useTranslation overload. This avoids excessive type instantiation with the merged locale catalog; its rendered columns, handlers and permissions are unchanged.

Session e2e adaptation: the shell search is now a read-only command-palette trigger. The expiry fixture focuses it instead of filling a dummy draft, and checks the route, focus return and palette availability after reauthentication. It no longer claims to prove form-draft persistence through session expiry. Existing form/draft and organization-cache logic is retained; restoring a real record-form draft after that cache is cleared is outside this visual rollout and has not been verified here.
