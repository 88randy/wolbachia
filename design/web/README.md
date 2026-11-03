# design/web — Wolbachia web app design export

## Where this comes from

- **Source canvas:** "Wolbachia · App Web" (Claude Design canvas), version 43.
- **Export date:** 2026-11-03.
- **Coverage:**
  - 71 screens (W1–W71) at 1280×800, plus the variants below;
  - the desktop design system;
  - global states;
  - 10 clickable journeys (R1–R10).
- **Variants:**
  - 1440×900: W2, W22, W53, W54;
  - English: W2, W35, W53;
  - dark: W53, W54.
- **Related docs:** `docs/web-screens.md`, `docs/web-api-needs.md`, `docs/web-tokens-diff.md`, issues 20–38.
- **Fix made during the export:** boards B06, B12 and B14 had one unclosed `<div>` each. Because of it, W45, W15 and W36 swallowed the neighbouring columns (W46, W16, W37/W40). The fix is applied in the canvas and in `source/`. No visual content changed.

## How to use it

1. **`screens/*.png` is the visual reference.** File names start with the screen code (`W35-egg-count.png`).
   - Suffixes: `-1440` = 1440×900, `-en` = English copy, `-dark` = dark theme.
   - `states-*.png` are the global states (loading, offline, pending upload, session expiring, epi-week closing, no permission, server error). They apply to every screen.
   - `design-system.png` is the desktop component sheet.
   - `prototype-R*.png` show only the **first step** of each clickable journey. The later steps reuse screens that already have their own PNG.
   - Every PNG is 1×, exact pixel size: 1280×800 or 1440×900. Two exceptions: W19 (labels board, 1960×900, labels at 96 px per inch) and the design-system sheet (1600×5657).
2. **`source/*.dc.html` is the markup reference.** One file per canvas board, in the Claude Design format (`<x-dc>`, `<sc-if>`, `<sc-for>`, `class Component extends DCLogic`).
   - They load `./support.js`, the Design runtime. It is **not included** because it belongs to the design tool, so the files do not render standalone. Read them for structure, copy and class names.
   - `source/web.css` holds every token (`:root` and `.dark`) and the desktop components.
   - `source/canvas.json` is the canvas index (board positions, titles, order, notes).
3. **Tokens:** take values from `packages/tokens`, never from `web.css`. `web.css` shows the intent; the section "Token differences" says what still has to be added to or unified in `packages/tokens`.
4. **The HTML is reference only. The web is built in React** (`web/`):
   - data comes through `packages/api-client`;
   - copy comes from `packages/i18n`;
   - colors, radii and spacing come from `packages/tokens`.

   Names, numbers, codes and versions in the screens are sample data. Bracketed text (`[Teléfono del centro]`, `[Método]`) is a placeholder.
5. **Decisions win over pixels.** Where a screen contradicts a decision in the root CLAUDE.md or the issues, follow the decision (see "Known gaps").

### Board → screens

| Source file | Contains |
|---|---|
| Main.dc.html | Desktop design system |
| B01-Nucleo | W1, W2, W3, W4 |
| B02-Incidentes | W6, W7 |
| B03-Inventario | W10, W13, W14 |
| B04-Cuadrantes | W23 |
| B05-Laboratorio | W35, W38 |
| B06-Liberaciones | W43, W45, W46 |
| B07-Tableros | W53 (with bands), W53 (no thresholds + drill-down), W54 |
| B08-Config | W62 |
| B09-Portal | W69, W70 |
| B10-Etiquetas | W19 (five QR labels at real size) |
| B11-EN-Oscuro | W53 dark, W35 English |
| B12-Inventario2 | W8, W9, W12, W15, W16 |
| B13-Inventario3 | W11, W17, W18 |
| B14-Laboratorio2 | W34, W36, W37, W40 |
| B15-Laboratorio3 | W39, W41, W42 |
| B16-Cuadrantes2 | W22, W24, W25, W26, W27 |
| B17-Operacion | W28, W29, W30 |
| B18-Operacion2 | W31, W32, W33 |
| B19-Regulatorio | W58, W59, W60, W61 |
| B20-Config2 | W63, W64, W65, W66 |
| B21-Config3 | W67, W68, W71 |
| B22-Personal | W48, W49, W50, W51 |
| B23-Flota | W5, W20, W21, W44, W47 |
| B24-Tableros2 | W52, W55, W56, W57 |
| B25-1440 | W2, W22, W53, W54 at 1440×900 |
| B26-EN-Oscuro2 | W2 English, W53 English, W54 dark |
| B27-Estados | Global states |
| P-Indice, P-R1…P-R10 | Clickable journeys R1–R10 |

## Screen → issues

Profiles:

| Code | Profile |
|---|---|
| SUP | Supervisor |
| COO | Coordinator |
| ENT | Entomologist / lab |
| ALM | Warehouse |
| REG | Regulatory |
| PRO | Promoter |
| ADM | Admin |
| GOB | Government, external read-only |

COO, ALM, REG and GOB are [PENDING] as separate profiles (see issue 20). The profile per screen is the design proposal; the role matrix (W65) and the backend decide.

"—" in the issue column means no epic covers the screen yet (see "Known gaps").

| W | Screen | Profiles | PNG | Source | Issue / epic |
|---|---|---|---|---|---|
| W1 | Sign-in | all | W01-login.png | B01-Nucleo.dc.html | #28 (epic #20) |
| W2 | Home | all | W02-home.png, W02-home-1440.png, W02-home-en.png | B01, B25, B26 | epic #20 |
| W3 | Universal search | internal | W03-universal-search.png | B01 | epic #20 |
| W4 | Universal record | internal | W04-universal-record.png | B01 | epic #20 |
| W5 | Notifications | internal | W05-notifications.png | B23-Flota.dc.html | epic #20 |
| W6 | Incident tray | SUP, COO, ADM | W06-incident-tray.png | B02-Incidentes.dc.html | #33 (epic #22) |
| W7 | Incident detail | SUP, COO, ADM | W07-incident-detail.png | B02 | #33 (epic #22) |
| W8 | Supply catalog | ADM, ALM | W08-supply-catalog.png | B12-Inventario2.dc.html | epic #23 |
| W9 | Lots | ALM, SUP | W09-lots.png | B12 | — [PENDING] |
| W10 | New biological lot | ALM | W10-new-biological-lot.png | B03-Inventario.dc.html | — [PENDING] |
| W11 | Locations | ADM, ALM | W11-locations.png | B13-Inventario3.dc.html | — [PENDING] |
| W12 | Transfers | ALM | W12-transfers.png | B12 | — [PENDING] |
| W13 | Center reception | SUP | W13-center-reception.png | B03 | — [PENDING] |
| W14 | Discrepancies | ALM, SUP | W14-discrepancies.png | B03 | — [PENDING] |
| W15 | Courier assignment | SUP | W15-courier-assignment.png | B12 | — [PENDING] |
| W16 | Daily reconciliation | SUP | W16-daily-reconciliation.png | B12 | — [PENDING] |
| W17 | Write-offs | ALM, SUP | W17-write-offs.png | B13 | — [PENDING] |
| W18 | Biological lot conditions | ALM, ENT | W18-biological-lot-conditions.png | B13 | — [PENDING] |
| W19 | QR labels | ALM | W19-qr-labels.png | B10-Etiquetas.dc.html | — [PENDING] |
| W20 | Motorcycles | SUP, ADM | W20-motorcycles.png | B23 | — [PENDING] |
| W21 | Motorcycle record | SUP, ADM | W21-motorcycle-record.png | B23 | — [PENDING] |
| W22 | Quadrant map | SUP, COO, ENT | W22-quadrant-map.png, W22-quadrant-map-1440.png | B16-Cuadrantes2.dc.html, B25 | — [PENDING] |
| W23 | Quadrant editor | COO, ENT | W23-quadrant-editor.png | B04-Cuadrantes.dc.html | — [PENDING] |
| W24 | Blocks and sampling points | ENT, COO | W24-blocks-sampling-points.png | B16 | — [PENDING] |
| W25 | Quadrant assignment | SUP, COO | W25-quadrant-assignment.png | B16 | epic #22 |
| W26 | Scheduling | SUP | W26-scheduling.png | B16 | epic #22 |
| W27 | Risk categories | ENT | W27-risk-categories.png | B16 | — [PENDING] |
| W28 | Live shifts | SUP, COO | W28-live-shifts.png | B17-Operacion.dc.html | epic #22 |
| W29 | Validate shift | SUP | W29-validate-shift.png | B17 | #34 (epic #22) |
| W30 | Review queue | SUP | W30-review-queue.png | B17 | epic #22 |
| W31 | Relocations | SUP | W31-relocations.png | B18-Operacion2.dc.html | epic #22 |
| W32 | Third-party interventions | SUP, ENT | W32-third-party-interventions.png | B18 | epic #22 |
| W33 | Quadrant closure | SUP, COO | W33-quadrant-closure.png | B18 | epic #22 |
| W34 | Lab bag reception | ENT | W34-lab-bag-reception.png | B14-Laboratorio2.dc.html | #30 (epic #21) |
| W35 | Egg count | ENT | W35-egg-count.png, W35-egg-count-en.png | B05-Laboratorio.dc.html, B11 | #31 (epic #21) |
| W36 | Recounts | ENT | W36-recounts.png | B14 | epic #21 |
| W37 | Recycled egg paddles | ENT | W37-recycled-egg-papers.png | B14 | epic #21 |
| W38 | UIEB shipment / Annex VI | ENT, REG | W38-uieb-shipment.png | B05 | epic #21 |
| W39 | Lab biological write-offs | ENT | W39-lab-biological-write-offs.png | B15-Laboratorio3.dc.html | epic #21 |
| W40 | Wolbachia results | ENT | W40-wolbachia-results.png | B14 | epic #21 |
| W41 | Third-party material requests | ENT, REG | W41-third-party-material-requests.png | B15 | epic #21 |
| W42 | Larval studies (optional) | ENT | W42-larval-studies.png | B15 | epic #21 |
| W43 | Permit types (empty) | REG, ADM | W43-permit-types-empty.png | B06-Liberaciones.dc.html | — [PENDING] |
| W44 | Permits | REG | W44-permits.png | B23 | — [PENDING] |
| W45 | Permit detail / suspend | REG | W45-permit-detail-suspend.png | B06 | — [PENDING] |
| W46 | Releases | COO, REG | W46-releases.png | B06 | — [PENDING] |
| W47 | Release devices | ALM, COO | W47-release-devices.png | B23 | — [PENDING] |
| W48 | Users | ADM | W48-users.png | B22-Personal.dc.html | #37 (epic #24) |
| W49 | Person record | ADM (SUP limited) | W49-person-record.png | B22 | #37 (epic #24) |
| W50 | Trainings | ADM | W50-trainings.png | B22 | epic #24 |
| W51 | Evaluation sheet | SUP, COO | W51-evaluation-sheet.png | B22 | epic #24 |
| W52 | Community | PRO | W52-community.png | B24-Tableros2.dc.html | — [PENDING] |
| W53 | Entomology dashboard | ENT, COO, SUP | W53-entomology-dashboard.png, -no-thresholds-drilldown, -1440, -en, -dark | B07-Tableros.dc.html, B25, B26, B11 | #38 (epic #25) |
| W54 | Wolbachia prevalence | ENT, COO | W54-wolbachia-prevalence.png, -1440, -dark | B07, B25, B26 | epic #25 |
| W55 | Operations dashboard | SUP, COO | W55-operations-dashboard.png | B24 | epic #25 |
| W56 | Comparison | COO | W56-comparison.png | B24 | epic #25 |
| W57 | Official exports | REG, ENT | W57-official-exports.png | B24 | epic #25 |
| W58 | ARCO requests | REG | W58-arco-requests.png | B19-Regulatorio.dc.html | epic #24 |
| W59 | Data transfers | REG | W59-data-transfers.png | B19 | epic #24 |
| W60 | Access log | REG, ADM | W60-access-log.png | B19 | epic #24 |
| W61 | Retention | REG, ADM | W61-retention.png | B19 | epic #24 |
| W62 | Rule parameters | ADM | W62-rule-parameters.png | B08-Config.dc.html | #36 (epic #23) |
| W63 | Catalogs | ADM | W63-catalogs.png | B20-Config2.dc.html | #35 (epic #23) |
| W64 | Incident types | ADM | W64-incident-types.png | B20 | epic #23 |
| W65 | Roles and permissions | ADM | W65-roles-permissions.png | B20 | epic #24 |
| W66 | API keys | ADM | W66-api-keys.png | B20 | epic #24 |
| W67 | Mobile app versions | ADM | W67-mobile-app-versions.png | B21-Config3.dc.html | epic #24 |
| W68 | Organization | ADM | W68-organization.png | B21 | epic #24 |
| W69 | Portal home | GOB | W69-portal-home.png | B09-Portal.dc.html | epic #25 |
| W70 | Portal map and trends | GOB | W70-portal-map-trends.png | B09 | epic #25 |
| W71 | Portal downloads | GOB | W71-portal-downloads.png | B21 | epic #25 |
| — | Global states | all | states-*.png | B27-Estados.dc.html | #29, #32 (epic #20) |
| — | Desktop design system | — | design-system.png | Main.dc.html, web.css | #26 (epic #20) |
| — | Journeys R1–R10 | — | prototype-*.png | P-Indice, P-R1…P-R10 | per screen above |

## Token differences

**Baseline:** `design/mobile/source/codequim.css`. Verified on 2026-11-03: every color shared by both files, light and dark, has the same value. Several rows below (neutrals, status backgrounds, dark set) already exist in mobile; the authoritative comparison is `docs/web-tokens-diff.md`, implemented in #17.

The base palette is unchanged and matches exactly:

| Role | Value |
|---|---|
| Brand | #3772FF |
| Action | #1A5DFF |
| High contrast | #0044E6 |
| Navy | #0A1A3F |
| Tint | #EBF1FF |
| Success | #0B6B35 |
| Warning | #8A4B00 |
| Critical | #B3141A |
| Typography | Inter with tabular figures |

### Colors not in the base list

| Value(s) | Used for | Proposal for `packages/tokens` |
|---|---|---|
| #F4F6FA, #FFFFFF | page background, surface | add `neutral.bg`, `neutral.surface` |
| #3A4664, #586380 | secondary / tertiary text | add `text.secondary`, `text.tertiary` |
| #C9D0DE, #E4E8EF, #7C869E | borders (default, soft, strong), disabled bg | add `border.default`, `border.soft`, `border.strong`, `bg.disabled` |
| #EEF0F5 | neutral badge background | add `status.neutral.bg` |
| #C9D3EA, rgba(255,255,255,.12) | sidebar text and hover on navy | add `sidebar.text`, `sidebar.hover` (web only) |
| #E3F5EA, #FFF1D6, #FDE8E8 | success / warning / critical backgrounds | add `status.*.bg` (check whether mobile already has them) |
| #F1F8E6 | "good" band in entomology charts | add `band.good`; `band.optimal`, `band.alarm` and `band.emergency` reuse the status backgrounds |
| #EEF1EC, #E2E6DF, #CFE0F2, #D3D8CF | map land, blocks, water, outlines | add `map.*` (web only) |
| #D9620B, #7A3CC4 (#B04F06 on some markers) | 2nd and 4th chart series | **not in the Codequim palette**: approve as `chart.2` / `chart.4` or replace [PENDING] |
| #E4ECFF, #C7D7FF, #8FB0FF, #5786FF | inline tints/borders of brand blue (selected rows, chips, map highlights) in some boards | replace with `tint` / `brand` + opacity, or add a `brand.100–400` ramp [PENDING] |
| #F3B9BB, #FFF7F7, #9FD7B5, #9EABC8 | inline borders of critical / success notices, a muted label | replace with `status.*.border`, or derive [PENDING] |
| Dark theme set (`.dark` in web.css: #0B1630, #13244A, #7FA4FF, #9DBBFF, #5FD08F, #FFB547, #FF8A8A …) | W53/W54 dark | the design says it uses the mobile dark tokens; confirm against codequim.css and keep a single set [PENDING] |

Canvas-only colors (#E3E7EE board background, #B8C0D0 frame outline) are presentation only. Do **not** port them.

### Radius

The base scale is 8 / 12 / 16 / 20. The web uses:

| Web value | Where | Proposal |
|---|---|---|
| 8 | buttons, nav items, inputs, search | keep (matches) |
| 12 | cards, KPIs, table wrapper, badges | keep (matches) |
| 10 | screen frame, notices, toasts, nav counters | → 8 (notices, toasts) or 12 (frame) |
| 14 | modals, side panel cards | → 16 |
| 15 | avatars, pills, map rider | → full / pill (`radius.full`) |
| 2, 3, 4, 6, 7, 9, 11, 13 | legend swatches, keyboard keys, checkboxes, skeletons, counters, wizard dots, map markers | add `radius.xs = 4` for small controls; the rest → 4, 8 or full |

### Spacing

The base unit is 8. Values used in `web.css` gaps, paddings and margins, with occurrence counts:

| Value | Times used | Fits base 8? |
|---|---|---|
| 8 | 28 | yes |
| 16 | 11 | yes |
| 24 | 2 | yes |
| 32 | 1 | yes |
| 40 | 4 | yes |
| 56 | 1 | yes |
| 4 | 12 | half step |
| 12 | 24 | half step |
| 20 | 6 | half step |
| 6 | 21 | no |
| 10 | 23 | no |
| 14 | 7 | no |
| 18 | 3 | no |
| 1, 2, 3, 5 | 13 in total | no (borders and icon nudges) |

Proposal: allow a 4 px half step (`space.0_5 = 4`, `space.1_5 = 12`, `space.2_5 = 20`) and snap 6 → 4 or 8, 10 → 8 or 12, 14 → 12 or 16, 18 → 16 or 20.

### Type and sizes

- Body is 14/20 on web (desktop density). Labels are 12–13.
- Some chips and chart labels use 10–11 px. Proposal: 12 px minimum, and add `font.size.xs = 12` if mobile does not have it.
- Display sizes in use: 24, 26, 30, 32, 44.
- Control heights: 32 / 36 / 40 / 44 (default button 36). Proposal: `control.sm/md/lg`.
- Focus ring: 2 px solid action, 2 px offset. Proposal: `focus.ring`.

## Known gaps

### Screens

- **No epic yet** (marked "—" above): inventory and labels (W9–W19), fleet (W20–W21), quadrants and sampling (W22–W24, W27), permits and releases (W43–W47), community (W52). [PENDING] Create epics.
- **Phone-width versions:** none are designed. The courier works in the mobile app. [PENDING] Decide whether the government portal (W69–W71) or any back-office screen needs a phone layout. No phone PNGs were exported because none exist in the canvas.
- **Prototype PNGs:** each one shows only the first step of its journey.
- **Stand-alone rendering:** the `.dc.html` files need the Design runtime, which is not included.

### Design vs decisions (follow the decision)

1. **No field egg count.** The courier only marks whether the egg paddle is present and, if so, whether it has eggs (Yes/No), but the design still contains field counts in several places:
   - W34 shows "field eggs";
   - W36 compares "1 · Campo" vs "2 · Laboratorio" with a 10 % limit;
   - the W53 drill-down shows a field and a lab count;
   - the W19 reading-bag label has a hand-written "Huevos" (eggs) box;
   - journeys R3 and R8 repeat the same.

   [PENDING] Recount trigger and the redesign of these screens.
2. **Parameters per organization, not per region.** W62 and W37 say "per region" ("parámetro de la región"). [PENDING] Is a regional override needed?
3. **"Other (specify)".** It must close every open list; it is shown explicitly only in W64. Check the rest when building.

### Decisions [PENDING]

| Topic | Status |
|---|---|
| Authentication | session vs token. W1 also shows a 6-digit second step, a "session expired" state and a first-time privacy notice; 2FA and privacy-notice acceptance are not decided (issue #28) |
| Session expiry | B27 shows "Session about to expire · Stay signed in"; a refresh mechanism is not defined |
| Pagination | cursor vs page number (issue #29) |
| Error format | error envelope / codes for i18n |
| ARCO deadline | the 20 business days shown in W58 is a sample value; legal must confirm |
| Evaluation sheet weights | W51 section weights (Presentation, Execution, Coverage) |
| Entomology | bands and thresholds, the 60 % prevalence threshold, the 10 % field-vs-lab limit (to be removed), and the Pupae index / IPP / ICPP formulas — all sample or unconfirmed |
| Profiles | whether COO, ALM, REG and GOB are separate profiles |
| Tokens | real names in `packages/tokens`; approval of the extra chart colors |

### Differences with `docs/web-api-needs.md`

| Design shows | API doc |
|---|---|
| W1 second-factor step and privacy-notice acceptance | no endpoints for either |
| B27 "Stay signed in" and "epi-week closing" notice | no session-refresh endpoint; no week-closing concept |
| W19 label printing | `/lots/{id}/labels/` covers lots only; ovitrap, reading-bag, device and sample labels have no endpoint; backend vs web PDF generation [PENDING] |
| W34 / W36 / W53 field egg counts | the API has only `paddle_present` and `has_eggs`, which is the decided behavior; the screens must change, not the API |
| W62 "per region" | API is per organization |
| W38 / W57 empty RFC column | consistent with the API's data-transfer rule; no gap |
