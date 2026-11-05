---
name: ui-ux-standards
description: 'Use this skill for ANY user-facing work in wolbachia web/ or mobile/: new screens, shared components, loading/empty/error states, forms, tables, dialogs, navigation, motion, or a UI review. It is the project''s UI/UX standard (owner-approved, 2026-11-05): soft data-first visual language, skeletons instead of spinners, optimistic UI, undo instead of confirm, command palette, resizable sidebar, discreet scrollbars, no native alerts, field-safe mobile. Trigger phrases: "build a screen", "design this UI", "improve the UX", "loading state", "empty state", "review the UI".'
version: 1.0.0
author: wolbachia team
tags:
  - ui
  - ux
  - design-system
  - accessibility
---

# UI/UX standards (web + mobile)

These are the project's interaction and visual rules. They apply to every screen in `web/` and `mobile/`. They come from the owner's direction: references similar to modern analytics dashboards, and the patterns used by Apple, Meta/Instagram, Linear, Claude and ChatGPT.

**Precedence:** WCAG 2.2 AA, `docs/engineering-rules.md`, `CLAUDE.md` (Web section) and the issue win over this skill. This skill wins over personal taste and over generic skill advice (`dashboard-designer`, `chart-builder`).

## 1. Visual language

| Element | Rule |
|---|---|
| Canvas | Soft cool-grey background (`color.canvas`/`background`). Content sits on raised white surfaces (`surface`), never directly on the canvas. |
| Cards | Large radius (`radius.lg`/`xl`, 16–20 px). Hairline border (`border.soft`) plus a very soft diffuse shadow (`shadow`). No heavy borders and no double borders. |
| Spacing | 8 px grid (`spacing`). Generous white space: 24 px card padding on web and 16 px on mobile. Group by space before adding lines. |
| Typography | One UI sans for text, plus one mono with tabular figures for numbers, dates, times, codes, IDs, column headers and badges. KPI values are large and their labels small and quiet. Never below 12 px. |
| Column headers | Small, uppercase, mono, letter-spaced, `text.secondary`. |
| Color | Neutrals carry the layout. One warm accent (`action`) for primary actions and attention, plus one cool secondary for neutral data series. Deltas: green for up and red/orange for down, always with sign and text. |
| Status | Tinted pill (`status.*.bg`) with mono uppercase text, an icon and `status.*.fg`. Never color alone. |
| Icons | `lucide-react` (web), outline style. Sizes from `web.icon` (16/20/24). Every icon-only control has an accessible name. |
| Dark mode | Every token has a dark value. Test both themes; a component that only works in light is not done. |
| Contrast | Text ≥ 4.5:1 and UI/focus ≥ 3:1. The references use very light greys; darken them rather than break contrast. |

**No literals:** colors, radii, shadows, spacing and font sizes come only from `packages/tokens`. A missing value goes to `packages/tokens` in the same PR, never into a component.

## 2. Layout

### Web shell
- **Three columns on wide screens:**
  - Sidebar.
  - Main column: page title, filters, content.
  - Optional right rail of compact widget cards (title, period selector, key numbers, mini chart). Under `web.layout` breakpoints the rail moves below the main column.
- **Sidebar:**
  - Logo on top. Navigation shows icon plus label, and the active item is a pill. Nested groups use tree lines.
  - The footer holds the light/dark toggle and the user menu.
  - **Collapsible** to an icon rail (tooltips on the icons).
  - **Resizable:** dragging the edge changes its width, like the Claude app, between a min and a max width (`web.layout`).
    - Width and collapsed state persist per browser (localStorage, try/catch).
    - The handle is a focusable `role="separator"` with `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin` and `aria-valuemax`.
    - Left/Right arrows change the width in steps, Enter toggles collapse, and double-click resets the default width.
- **Top area:** pill-shaped search that opens the command palette, notifications, and the organization/center context.
- **Page anatomy, top to bottom:**
  1. title, with a one-line purpose if not obvious;
  2. a KPI strip, if the page has metrics;
  3. filters as chips with "Clear filters";
  4. primary content;
  5. a footer note (data source, "updated N min ago").
- **Max line length** about 75 characters for prose. Tables may use the full width.

### Mobile
- One primary task per screen.
- The primary action is full-width at the bottom (thumb zone).
- Secondary actions go in a bottom sheet.
- The top bar shows title, sync chip and at most one action.
- Maps are full screen with no surrounding `ScrollView`.

## 3. Loading, empty and error states (every data view has all four)

| State | Rule |
|---|---|
| **Loading** | A **skeleton** shaped like the final content: rows for tables, blocks for cards, lines for text. It uses a subtle shimmer that stops with `prefers-reduced-motion`. **No page or table spinners.** A spinner is allowed only inside a button while its own action runs. Skeletons appear after about 150 ms to avoid a flash on fast loads. |
| **Refreshing** | Keep the old data visible (stale-while-revalidate) with a thin top progress bar or a "Updating…" chip. Never blank the screen. |
| **Empty** | Icon or illustration, one sentence saying why it is empty, and the next action ("Create the first catalog item", "Clear filters"). Distinguish "no data yet" from "no results for these filters". |
| **Error** | Blameless message from i18n (`code` → text), what the user can do, a **Retry** action, and details that can be expanded (code and request id). Keep the rest of the page usable: scope the error to the component that failed. |
| **Partial** | When some widgets fail, show them in their error state and keep the others. |

**No layout shift:** reserve space for images, charts, badges and async content. Skeletons have the final dimensions.

## 4. Feedback and confirmations

- **Never use native `alert`, `confirm` or `prompt` (web), and never `Alert.alert` (mobile).** Lint enforces this (`no-alert`, restricted `Alert` import).
- **Undo instead of confirm** for reversible actions (archive, deactivate, reorder, remove a filter, dismiss): apply at once and show a toast/snackbar with **Undo** for about 5 s (longer when focus is in the toast).
- **Confirm modal only for irreversible or high-impact actions,** for example voiding with a reason, publishing a version, or revoking access. The modal names the consequence, the destructive button says what it does ("Void record", not "OK"), and Cancel is the default focus.
- **Inline notices** (banner inside the card or section) for persistent conditions: permission missing, rule outdated, offline. Each one carries its action (Retry, Review, Update).
- **Toasts** only for transient results. They live in an `aria-live="polite"` region (`assertive` only for errors that block), and they never steal focus.
- **Disabled controls** explain why and who can unblock them (tooltip or helper text), per `CLAUDE.md`.

## 5. Optimistic UI

- Reflect the change immediately when the server almost always accepts it and the change is reversible: toggles, reorder, rename, mark read.
- On failure: roll back, show an inline notice or toast with **Retry**, and keep the user's input.
- **Never optimistic** for irreversible, authorization-gated, money/quantity or audit-critical actions (void, publish, approve, egg counts, permits). Those show progress in the button and wait for the server.
- Optimistic writes still go through org-scoped query keys and the session rules (decision 92). Never write session state outside the session controller.

## 6. Navigation and productivity

- **Command palette** (`Ctrl/Cmd+K`, `cmdk`): navigation to every screen the user may see, recent records, and the main actions for the current page. Results respect permissions.
- **Keyboard shortcuts:** `?` opens a dialog that lists them. Shortcuts never fire while typing in a field. Use standard keys (Esc closes, Enter submits, `/` focuses search).
- **Progressive disclosure:** details open in an expandable row or a side sheet, keeping the list and its scroll position. A full page is used only for records that need their own URL (`/<area>/<resource>/<code>`); side sheets also update the URL so they can be shared.
- **URLs are state:** filters, sorting, paging, the open tab and the open sheet live in the query string.
- **Back works:** the browser back closes a sheet before it leaves the page.

## 7. Forms

- Labels are always visible, never placeholder-only. Hints sit under the field.
- **Inline validation on blur,** and on change only after the first error. Show the summary of errors at the top only after submit, linked to each field.
- **Drafts persist** (session storage, keyed by identity per decision 92) and are restored with a notice "Draft restored · Discard".
- The submit button shows progress and prevents double submit. On success, return to the context the user came from.
- Open option lists end with "Other (specify)", which requires the text.
- Use the right input types: numeric keypad for numbers, date pickers in the org's time zone, autocomplete for long lists.

## 8. Tables and lists

- Server-side paging, sorting and filtering (`CLAUDE.md`).
- **Sticky header** and a sticky first column when the table is wider than the viewport. Horizontal scroll stays inside the table.
- Numbers are right-aligned in mono tabular figures and link to the filtered list behind them.
- Row hover is subtle. Row actions appear on hover/focus and are always reachable by keyboard and screen reader.
- Group rows by meaningful time (Today, Yesterday, date) when it helps scanning. Expandable detail rows follow progressive disclosure.
- Voided rows are struck through with a "Voided" badge, reason and author, and hidden by default.
- **Relative times** ("5 min ago") with the absolute date-time in the org time zone on hover/focus (a `<time datetime>` element plus a tooltip).
- Density toggle (comfortable/compact) on large operational tables.

## 9. Data visualization

- Use `chart-builder` and `dashboard-designer` for chart choice and KPI design.
- Thin lines, muted palette, the accent only for the highlighted series. Floating tooltip card with the exact values.
- **Every chart has an equivalent data table** (toggle or below the chart) and a title that states the insight.
- KPIs always carry a comparison (target or previous period) with a signed delta.
- Map areas use color plus pattern (`CLAUDE.md`).

## 10. Scroll and overflow

- **One discreet scrollbar style everywhere,** vertical and horizontal: a thin track with low contrast, and a thumb that gets stronger on hover/drag (≥ 3:1 while hovered). Defined once from tokens (CSS `scrollbar-width`/`scrollbar-color` plus `::-webkit-scrollbar`), the same in light and dark.
- Never hide scrollbars completely on scrollable regions, and never nest scroll containers on the same axis without need.
- Scrollable regions that receive focus are keyboard-scrollable (`tabindex="0"` plus an accessible name when needed).
- Mobile: native thin indicators. FlatList for long lists, never a map inside a ScrollView.

## 11. Motion

- 150–200 ms for hover, press, expand and enter/exit; 250 ms at most for sheets and modals. Use standard easing (ease-out for enter, ease-in for exit).
- Animate opacity and transform only; never layout properties.
- `prefers-reduced-motion`: remove shimmer, slide and scale; keep instant state changes.
- Motion explains a change (where something came from or went). No decorative loops.

## 12. Accessibility (non-negotiable)

- Everything works with the keyboard. The focus ring is visible: 2 px `action` with a 2 px offset.
- Modals and sheets trap focus, close with Esc and return focus to the trigger. Use the primitives (Radix UI or React Aria) rather than hand-made dialogs.
- Target size ≥ 24×24 px on web (design controls are 32–44 px) and ≥ 48 dp on mobile.
- Status is never color alone. Live regions announce toasts and scan results.
- Layouts survive +30 % text length and 200 % zoom (web), and 130 % font scale on mobile (no fixed heights, no `numberOfLines`).
- All copy comes from `packages/i18n` (es-MX, en). No hard-coded strings, including `aria-label`s.

## 13. Mobile field rules (courier app)

The courier works outdoors, in the sun, often with gloves and in a hurry, offline.
- **Contrast** higher than the minimum for key data; no light-grey text on white for anything the courier must read.
- **Large targets** (≥ 48 dp), primary action at the bottom, and no precise gestures required.
- **Skeletons** for local loads; **pull to refresh** only where data comes from the server.
- **Bottom sheets** for choices and secondary actions; **snackbar with Undo** for reversible actions.
- **Haptics** (light) on key confirmations (saved on the phone, scan success) where available.
- Truthful delivery states: "saved on the phone", "received by the server" and "reviewed" are different, and the UI never says "sent" before it is.
- Avoid blur and heavy effects on low-end Android; use simple elevation.
- Fonts are bundled offline.

## 14. Technology choices

- **Web:**
  - CSS Modules plus token CSS variables. No Tailwind.
  - Unstyled accessible primitives (Radix UI or React Aria, one of them, chosen in #202) for dialog, popover, menu, tooltip and tabs.
  - `cmdk` for the command palette, `react-resizable-panels` (or equivalent) for the sidebar, `lucide-react` for icons, TanStack Query/Router/Table as today.
- **Mobile:** React Native components in `mobile/src/ui/` that consume the same tokens. No web-only libraries.
- Every new dependency is justified in the PR: why, alternatives, maintenance, size and license.

## 15. Anti-patterns (reject in review)

- Page/table spinners, blank screens while loading, layout jumps.
- Native `alert`/`confirm`/`prompt` or `Alert.alert`; a confirm modal for reversible actions.
- Color literals, ad-hoc shadows/radii, or text below 12 px.
- Status by color only; charts without a data table; KPIs without comparison.
- Generic errors ("Something went wrong") without the next action.
- Hidden or unstyled default scrollbars; nested same-axis scrolling.
- Losing the user's input or scroll position after an error or a sheet close.
- Placeholder-only labels; validation that fires on every keystroke before the first submit.
- Decorative animation, or motion that ignores reduced motion.

## 16. Definition of done for a UI change

- [ ] Loading (skeleton), empty, error and partial states implemented and tested.
- [ ] Light and dark checked; contrast ≥ AA; focus visible; keyboard path complete.
- [ ] No native dialogs; confirmations follow §4; optimistic updates follow §5.
- [ ] Tokens only; i18n only; +30 % text and the 320 px width (web) / 130 % font scale (mobile) checked.
- [ ] Tables/charts follow §8 and §9; scroll follows §10; motion follows §11.
- [ ] Tests cover the behavior (states, undo/rollback, keyboard) per `docs/engineering-rules.md` §9; e2e a11y matrix updated when a journey changes.
- [ ] The PR states the screen code (W/P number), shows screenshots (light/dark) and lists any deviation from the design with its reason.
