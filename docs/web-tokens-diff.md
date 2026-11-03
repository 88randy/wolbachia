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
| Map | land #EEF1EC, road #FFFFFF, block #E2E6DF, water #CFE0F2 | #14254A, #25396A, #1B2E58, #16335E | MapLibre style |
| Chart series | c1 #1A5DFF, c2 #D9620B, c3 #0B6B35, c4 #7A3CC4 | #7FA4FF, #FFA25C, #5FD08F, #C9A2FF | **c2 and c4 are not in the Codequim palette**: provisional, [PENDING] approval |
| Index bands | opt #E3F5EA, good #F1F8E6, alarm #FFF1D6, emer #FDE8E8 | #123A2A, #1A3424, #3A2A0E, #4A1A22 | opt/alarm/emer reuse status backgrounds; `good` is new |

## 4. Not tokens yet in the web design (proposal for #17)

- **Radius:** keep the shared scale 8 / 12 / 16 / 20 and add `xs = 4` for small controls. Web one-offs snap: 10 → 8 (notices, toasts) or 12 (frame), 14 → 16, 15 → full (pill).
- **Spacing:** base 8 with a 4 px half step; 6 → 4 or 8, 10 → 8 or 12, 14 → 12 or 16, 18 → 16 or 20.
- **Type (web):** body 14/20, labels 12–13, minimum 12 px (some chips and chart labels use 10–11 px in the design; raise them).
- **Control heights:** 32 / 36 / 40 / 44 px (button default 36) → `control.sm/md/lg/xl`.
- **Focus ring:** 2 px solid `action`, 2 px offset → `focus.ring`.

## 5. Decisions

1. Structure: semantic names (`color.text.primary`, `color.status.success.bg`, …) generated from the Codequim values. Accepted with the plan of 2026-11-03.
2. Aliases: one semantic token per role (`strong` and `info` share a value but stay separate roles). Accepted.
3. Chart colors c2 / c4: **[PENDING]** client approval; provisional until then.
4. Radius and spacing snapping above: proposal, applied in #17 unless the client objects.
