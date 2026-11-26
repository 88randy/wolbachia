# labels: print QR labels for the internal system

ALL labels are printed from one screen: W19 "Etiquetas QR" (`/inventory/labels`, code in
`web/src/inventory/labels`). The user picks the kind, searches and ticks records (server-side
search and paging) on the left; on the right (sticky, below the list on narrow screens) `LabelPrintPanel`
shows a live preview of the ticked labels with the format, copies and Print, no modal. There is one
rendering pipeline (this folder).  No other list or record screen
prints labels; a record page only links to W19.

## Record pages: "Imprimir etiqueta"

`PrintLabelLink` goes to `/inventory/labels?kind=<kind>&code=<human code>` and W19 ticks that
record. The URL carries the human code only, never an id. The link is hidden when the user cannot
read that kind (permissions in `label-kinds.ts`). Today: lots, locations, motorcycles.

## QR convention (fixed, the phone depends on it)

A QR encodes `wbf:1:<kind>:<value>`. `qrContent()` is the one place that decides it, from
`qrBy` in `LABEL_KIND_SPECS`:

| kind       | value        | why                                                                        |
| ---------- | ------------ | -------------------------------------------------------------------------- |
| lot        | record id    | `backend/ovitraps/qr.py` (`parse_qr`) accepts only a uuid for lot and bag  |
| bag        | record id    | same                                                                       |
| ovitrap    | record id    | the phone matches ovitrap labels by id, offline                            |
| paddle     | human code   | `parse_code_qr` accepts a code                                             |
| motorcycle | human code   | `parse_code_qr` accepts a code                                             |
| location   | human code   | no scanner reads locations yet; the code is what the screens show          |

The human code is always printed large on the label. An id is never visible: if a code looks like a uuid (`visibleText()`), the label and the list show the fallback (the ovitrap point) instead. Same design
for every kind: QR, big code, up to two context lines (`label-records.ts`).

## Pieces

- `label-kinds.ts`: the six kinds, their read permission and what the QR carries; the W19
  query-string schema.
- `label-formats.ts`: the three formats and limits (copies 1-50, 300 labels per job).
- `label-records.ts`: pure mappers from API rows to `LabelRecord` (id, code, up to 2 lines).
- `LabelPrintPanel.tsx`: format, copies, live preview and Print. Remembers the last choice in
  `localStorage` (`label-preferences.ts`, failures are ignored).
- `LabelPrintPortal.tsx` + `labels.module.css`: the print layout. A copy of the sheet goes under
  `<body>`; `@media print` hides everything else. Page sizes use named `@page` rules, one per
  format, so a roll prints one label per page and the letter sheet prints a 3 x 10 grid.

## Formats [ASSUMPTION]

The client's printers are unknown. 50 x 25 mm and 62 x 29 mm are common thermal rolls; the letter
sheet is an Avery 5160-like layout (66.7 x 25.4 mm). Confirm with the real printer and stock.

## Adding a kind

1. Add it to `LABEL_KINDS` / `LABEL_KIND_SPECS` (permission, `qrBy`) and to `LabelSource`.
2. Write its mapper in `label-records.ts` and its reader in `inventory/labels/label-query.ts`.
3. Add the `inventory.labels.kind.<kind>` message (es-MX and en).
