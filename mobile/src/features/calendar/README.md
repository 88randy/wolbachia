# P33 courier calendar (#373)

Read-only and offline. `CalendarService.read()` composes the P29 history read
(`entries` + D1 `unscoped`) with the downloaded tasks of `DayBundleService.read()`
and the organization profile (time zone, epi week). No network call, no write,
no migration.

`domain.ts` is pure: `buildCalendar` keys every item by its local date in the
organization zone (invalid or missing zone: `DEFAULT_TIME_ZONE`), keeps today and
the 29 previous days (`CALENDAR_WINDOW_DAYS`, within `LOCAL_RETENTION_MS`) plus dates up to the last downloaded
task, and lays out month grids from the epi week start (`mmwr` Sunday, `iso` or
missing Monday). `calendarStatus` follows the issue's status table; D2 accepted
decisions arrive from P29 as `reviewed`. An unparsable device time is listed last
on today and never marks the grid.

`calendar-reads.ts` guards the hook (`use-calendar.ts`): latest read wins; auth and
bundle notifications hide the view before re-reading; sync results re-read in place;
a failed read keeps the last view only for the same owner + session. The service
returns no tasks or activity unless the session is unlocked before and after the reads.
Days outside the window are laid out empty. Day routes come
from `TrackRecorder.linesForDay` (one line per shift, owner-only).

## UI

- Tab `calendar` (Mi día, Mapa, Calendario, Ayuda; Back from any tab returns to Mi día).
- `P33Screen`: one `AppFlatList` whose header is `CalendarHeader` (notices, `MonthNav`,
  `MonthGrid`, `CalendarLegend`, the selected day and `DayRouteAction`); rows are
  `CalendarTaskRow` (tasks first; only today's open like P9) and `CalendarItemRow`
  (activity newest first; voided struck through; rejected/error/in review link to P28).
- Grid cells are explicit variants (`DayCell`, `OutsideDayCell`, spacer) built by the pure
  `calendar-cells.ts`; markers are shapes (dot = activity, clock ring = pending) explained by the
  legend, and each cell's spoken label carries the date and counts. Cells are at least 48 dp.
- Status pills come from the shared table `ui/status-presentation.ts` (D4), also used by P28
  and P29. D2: accepted decisions say "Aceptado".
- History unavailable: P29's notice with a link to P28; the day never says "Sin actividad".
- `P33bScreen`: full-screen `MapView` with the day's `lines`, no ScrollView.
- `use-calendar.ts` re-reads on foreground and when the organization's date changes.
- No design board exists for P33: visuals follow S13 (P28/P29 cards and pills) and S05 (P9/P10).

Tests: `calendar-domain.test.ts`, `calendar-store.test.ts`, `calendar-reads.test.ts`,
`calendar-ui.test.ts`, `track-day-lines.test.ts`.
