# P33 courier calendar (#373) — data layer

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

Tests: `calendar-domain.test.ts`, `calendar-store.test.ts`, `calendar-reads.test.ts`,
`track-day-lines.test.ts`.
