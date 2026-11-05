# Shared analytics components

Issue #202 step 1. These presentational components accept already authorized, display-ready data; they do not fetch, filter or aggregate server records.

- `KpiStrip` groups `KpiCell` children in one raised surface. `KpiCell` takes a translated label, a formatted value, an optional records `href`, a signed numeric `delta`, and optional `deltaUnit` (default `%`). Direction is conveyed with a sign, icon and spoken previous-period comparison.
- `RelativeTime` takes an ISO `dateTime`, the organization's `timeZone`, and an optional deterministic `now` in milliseconds. It uses the UI language and existing organization date formatter. The absolute time is available to screen readers and in a focus/hover tooltip.
- `TrendChart` takes `title`, period `labels`, and `series` (`id`, translated `label`, finite numeric `values`, optional palette `tone` 1–4). Each series supplies one value for every label. All series share a unit; `valueSuffix` displays it. Hover or the labeled keyboard range control inspects periods. A disclosure exposes all raw values in an equivalent table. Lines also differ by dash and marker shape.
- `MiniBarChart` takes `title`, `labels`, nonnegative `values`, and optional `valueSuffix`; it starts at zero and offers the same table disclosure.

Charts render inside a shared `Card` or another surface supplied by the caller. No chart library, network or stylesheet color literals are used. HTML axis labels keep their minimum font size when the SVG plot scales to a narrow viewport. Reduced motion removes tooltip animation.

Regression checks: `npx vitest run --maxWorkers=1 src/analytics` from `web/`.
