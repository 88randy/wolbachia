# P33 courier calendar (#373) — data layer

Read-only and offline. `CalendarService.read()` composes the P29 history read
(`entries` + D1 `unscoped`) with the downloaded tasks of `DayBundleService.read()`
and the organization profile (time zone, epi week). No network call, no write,
no migration.

`domain.ts` is pure: `buildCalendar` keys every item by its local date in the
organization zone (invalid or missing zone: `DEFAULT_TIME_ZONE`), keeps today and
the 29 previous days (`LOCAL_RETENTION_MS`) plus dates up to the last downloaded
task, and lays out month grids from the epi week start (`mmwr` Sunday, `iso` or
missing Monday). `calendarStatus` follows the issue's status table; D2 accepted
decisions arrive from P29 as `reviewed`. An unparsable device time is listed last
on today and never marks the grid.

`use-calendar.ts` re-reads on the P29 sources (auth, bundle, sync engine) with a
latest-read-wins sequence; a failed read keeps the last good view. Day routes come
from `TrackRecorder.linesForDay` (one line per shift, owner-only).

Tests: `calendar-domain.test.ts`, `calendar-store.test.ts`, `track-day-lines.test.ts`.
