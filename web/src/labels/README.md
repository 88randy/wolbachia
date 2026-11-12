# labels: print QR labels for the internal system

Shared label printing. Any list or record screen opens it with `PrintLabelsButton` (or
`PrintLabelsDialog` when it owns the open state) and a list of `LabelRecord`s.

## QR convention (fixed, shared with the web camera scanner)

A label's QR encodes `wbf:1:<kind>:<human code>` (kind = lot, bag, location, motorcycle), with the code exactly as the screens show it (lot code,
bag code, location code, motorcycle code). No URLs, no ids, no personal data. `qrContent()` is
the one place that decides this.

The older W19 screen (`web/src/inventory/labels`) prints `wbf:1:<kind>:<uuid>` payloads for the
mobile scanner. It is unchanged. The mobile scanner does not read bare codes for lots and bags yet.

## Pieces

- `label-formats.ts`: the three formats and limits (copies 1-50, 300 labels per job).
- `label-records.ts`: pure mappers from API rows to `LabelRecord` (code + up to 2 context lines).
- `use-row-labels.tsx`: what a list needs: "print this page" button and row selection.
- `PrintLabelsDialog.tsx`: format, copies, preview and Print. Remembers the last choice in
  `localStorage` (`label-preferences.ts`, failures are ignored).
- `LabelPrintPortal.tsx` + `labels.module.css`: the print layout. A copy of the sheet goes under
  `<body>`; `@media print` hides everything else. Page sizes use named `@page` rules, one per
  format, so a roll prints one label per page and the letter sheet prints a 3 x 10 grid.

## Formats [ASSUMPTION]

The client's printers are unknown. 50 x 25 mm and 62 x 29 mm are common thermal rolls; the letter
sheet is an Avery 5160-like layout (66.7 x 25.4 mm). Confirm with the real printer and stock.

## Adding a screen

1. Write a mapper in `label-records.ts` (or reuse one) with the human code and context lines.
2. In the list: `useRowLabels({ toRecord, rowLabel })`, pass `selection` to the `DataTable` and
   `pageAction(rows)` to the toolbar. In the record page: a `PrintLabelsButton` in the header.
3. Skip entities without a human code.
