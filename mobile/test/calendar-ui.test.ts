import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import { darkTheme, lightTheme } from "@wolbachia/tokens";
import { buildCalendar } from "../src/features/calendar/domain.ts";
import type { CalendarItem, CalendarStatus } from "../src/features/calendar/domain.ts";
import { monthCells } from "../src/features/calendar/calendar-cells.ts";
import { calendarFormat } from "../src/features/calendar/calendar-format.ts";
import { isStaleDay } from "../src/features/calendar/calendar-reads.ts";
import type { CalendarView } from "../src/features/calendar/service.ts";
import { dayRouteOf } from "../src/features/calendar/use-day-lines.ts";
import type { CachedTask } from "../src/features/day/types.ts";
import { createTranslate } from "../src/i18n/translate.ts";
import { componentHarness, flattenStyle, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const TODAY = "2026-11-25";
const MATRIX = (["es-MX", "en"] as const).flatMap((locale) =>
  (["light", "dark"] as const).map((scheme) => ({ locale, scheme })),
);
type Render = ReturnType<typeof componentHarness>["render"];
const texts = (nodes: readonly RenderNode[]) =>
  nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
const pressables = (nodes: readonly RenderNode[]) =>
  nodes.filter((node) => node.type === "Pressable");
/** 130 % text: nothing is cut (no numberOfLines), scaling stays on and no text is under 12. */
function assertReadable(nodes: readonly RenderNode[]) {
  for (const node of nodes.filter((candidate) => candidate.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}
const item = (overrides: Partial<CalendarItem>): CalendarItem => ({
  id: "e-1",
  kind: "fuel.load",
  time: "2026-11-25T15:00:00.000Z",
  status: "pending",
  codes: [],
  isScoped: false,
  source: "local",
  task: null,
  ...overrides,
});
const task = (date: string, serverCompletion: boolean | null): CachedTask => ({
  task: {
    id: `P-1:${date}`,
    point_code: "OV-010",
    point_id: "p-1",
    courier: "courier",
    action: "check",
    date,
    risk: "normal",
    version: "1",
    quadrant_id: "q",
    history: [],
  },
  isKept: false,
  serverCompletion,
});

void test("P33 tab bar: Mi día, Mapa, Calendario, Ayuda at 48 dp+, label never cut", () => {
  for (const { locale, scheme } of MATRIX) {
    const { render } = componentHarness({ locale, scheme, fontScale: 1.3 });
    const nodes = render("mobile/src/ui/BottomTabBar.tsx", "BottomTabBar", { active: "calendar" });
    const tabs = pressables(nodes);
    const m = messages[locale];
    assert.deepEqual(
      tabs.map((tab) => tab.props.accessibilityLabel),
      [
        m["courier.tabs.day"],
        m["courier.tabs.map"],
        m["courier.tabs.calendar"],
        m["courier.tabs.help"],
      ],
    );
    assert.deepEqual(
      tabs.map((tab) => (tab.props.accessibilityState as { selected: boolean }).selected),
      [false, false, true, false],
    );
    for (const tab of tabs) assert.ok(minHeightOf(tab) >= 48);
    assertReadable(nodes);
  }
});

void test("P33 D4 status pill: every status is icon + words in its tone (es-MX/en, light/dark)", () => {
  const statuses: readonly CalendarStatus[] = [
    "pending",
    "sending",
    "error",
    "sent",
    "in_review",
    "rejected",
    "reviewed",
    "voided",
    "observed",
    "scheduled",
    "done",
    "missed",
    "unconfirmed",
  ];
  for (const { locale, scheme } of MATRIX) {
    const { render } = componentHarness({ locale, scheme, fontScale: 1.3 });
    const labels = statuses.map((status) => {
      const nodes = render(
        "mobile/src/features/calendar/CalendarStatusPill.tsx",
        "CalendarStatusPill",
        { status },
      );
      assert.ok(
        nodes.some((node) => node.type === "Svg"),
        `${status} has an icon`,
      );
      assertReadable(nodes);
      return String(texts(nodes)[0]);
    });
    assert.equal(new Set(labels).size, statuses.length, "no two statuses share words");
    assert.equal(
      labels[statuses.indexOf("reviewed")],
      messages[locale]["mobile.calendar.statusAccepted"],
    );
  }
  const theme = { light: lightTheme, dark: darkTheme };
  const { render } = componentHarness({ locale: "es-MX", scheme: "dark", fontScale: 1 });
  const pill = render("mobile/src/features/calendar/CalendarStatusPill.tsx", "CalendarStatusPill", {
    status: "in_review",
  });
  const label = pill.find((node) => node.type === "Text");
  assert.equal(flattenStyle(label?.props.style).color, theme.dark.color.status.warning.fg);
});

function gridNodes(render: Render, locale: Locale) {
  const view = buildCalendar({
    entries: [],
    unscoped: [{ id: "f", kind: "fuel.load", time: "2026-11-24T15:00:00.000Z", status: "pending" }],
    tasks: [],
    timeZone: "America/Merida",
    epiWeek: "iso",
    today: TODAY,
  });
  const month = view.monthWeeks.find((candidate) => candidate.month === "2026-10");
  assert.ok(month);
  const format = calendarFormat(locale, "America/Merida");
  const cells = monthCells({
    month,
    days: new Map(view.days.map((day) => [day.date, day])),
    today: TODAY,
    selected: TODAY,
    t: createTranslate(locale),
    format,
  });
  const november = view.monthWeeks.find((candidate) => candidate.month === "2026-11");
  assert.ok(november);
  const novemberCells = monthCells({
    month: november,
    days: new Map(view.days.map((day) => [day.date, day])),
    today: TODAY,
    selected: TODAY,
    t: createTranslate(locale),
    format,
  });
  const props = (weeks: typeof cells) => ({
    weeks,
    weekdays: (weeks[0] ?? []).map((cell) => ({
      date: cell.date,
      name: format.weekday(cell.date),
    })),
    onSelect: () => undefined,
  });
  return {
    october: render("mobile/src/features/calendar/MonthGrid.tsx", "MonthGrid", props(cells)),
    november: render(
      "mobile/src/features/calendar/MonthGrid.tsx",
      "MonthGrid",
      props(novemberCells),
    ),
    format,
  };
}

void test("P33 grid: kept days are 48 dp buttons with date + counts; older days are disabled with the reason", () => {
  for (const { locale, scheme } of MATRIX) {
    const { render } = componentHarness({ locale, scheme, fontScale: 1.3 });
    const { october, november, format } = gridNodes(render, locale);
    const m = messages[locale];
    const outside = october.find(
      (node) =>
        node.props.accessibilityLabel ===
        m["mobile.calendar.outsideWindowLabel"].replace("{date}", format.dayDate("2026-10-26")),
    );
    assert.ok(outside, "a day older than the window says why");
    assert.equal((outside.props.accessibilityState as { disabled: boolean }).disabled, true);
    assert.equal(outside.type, "View", "not pressable");
    const pendingDay = pressables(november).find(
      (node) =>
        node.props.accessibilityLabel ===
        m["mobile.calendar.dayLabel"]
          .replace("{date}", format.dayDate("2026-11-24"))
          .replace("{activities}", "1")
          .replace("{pending}", "1"),
    );
    assert.ok(pendingDay, "the spoken label carries the date and counts");
    for (const cell of pressables(november)) assert.ok(minHeightOf(cell) >= 48);
    assert.ok(
      november.some((node) => String(node.props.className).includes("rounded-full bg-ink")),
      "activity is a filled dot (shape, not color only)",
    );
    assertReadable([...october, ...november]);
  }
});

void test("P33 rows: voided is struck through with Anulado; problems link to the inbox; D1 rows show no codes", () => {
  for (const { locale, scheme } of MATRIX) {
    const { render } = componentHarness({ locale, scheme, fontScale: 1.3 });
    const m = messages[locale];
    const voided = render("mobile/src/features/calendar/CalendarItemRow.tsx", "CalendarItemRow", {
      item: item({ status: "voided", source: "history", isScoped: true, codes: ["OV-1"] }),
      time: "09:00",
      onOpenInbox: () => undefined,
    });
    const title = voided.find((node) => node.type === "Text");
    assert.equal(title?.props.className, "line-through");
    assert.ok(texts(voided).includes(m["mobile.history.voided"]));
    assert.ok(texts(voided).includes("OV-1"));
    assert.equal(pressables(voided).length, 0);
    let opened = 0;
    for (const status of ["rejected", "error", "in_review"] as const) {
      const nodes = render("mobile/src/features/calendar/CalendarItemRow.tsx", "CalendarItemRow", {
        item: item({ status, codes: ["hidden"] }),
        time: null,
        onOpenInbox: () => {
          opened += 1;
        },
      });
      const link = pressables(nodes).find(
        (node) => node.props.accessibilityLabel === m["mobile.calendar.openInbox"],
      );
      assert.ok(link);
      assert.ok(minHeightOf(link) >= 48);
      (link.props.onPress as () => void)();
      assert.ok(texts(nodes).includes(m["mobile.history.unknownTime"]));
      assert.ok(!texts(nodes).includes("hidden"), "an unscoped row never shows codes");
      assertReadable(nodes);
    }
    assert.equal(opened, 3);
  }
});

void test("P33 task rows: today's opens like P9, other days are read-only", () => {
  const { render } = componentHarness({ locale: "es-MX", scheme: "light", fontScale: 1.3 });
  const row = (onStart: (() => void) | null) =>
    render("mobile/src/features/calendar/CalendarTaskRow.tsx", "CalendarTaskRow", {
      item: { ...item({ source: "task", status: "scheduled" }), task: task(TODAY, false).task },
      onStart,
    });
  let started = false;
  const today = pressables(
    row(() => {
      started = true;
    }),
  );
  assert.equal(today.length, 1);
  assert.ok(minHeightOf(today[0] as RenderNode) >= 48);
  (today[0]?.props.onPress as () => void)();
  assert.equal(started, true);
  const future = row(null);
  assert.equal(pressables(future).length, 0);
  assert.ok(texts(future).includes(messages["es-MX"]["mobile.calendar.statusScheduled"]));
  assertReadable(future);
});

void test("P33 unavailable history shows P29's notice with the inbox link, never 'no activity'", () => {
  for (const { locale, scheme } of MATRIX) {
    const { render } = componentHarness({ locale, scheme, fontScale: 1.3 });
    const m = messages[locale];
    let opened = false;
    const notices = render("mobile/src/features/calendar/CalendarNotices.tsx", "CalendarNotices", {
      hasError: true,
      isUnavailable: true,
      onRetry: () => undefined,
      onOpenInbox: () => {
        opened = true;
      },
    });
    assert.ok(texts(notices).includes(m["mobile.history.unavailable"]));
    assert.ok(texts(notices).includes(m["mobile.calendar.readFailed"]));
    const [retry, inbox] = pressables(notices);
    assert.ok(retry && inbox, "Retry and the inbox link are both reachable");
    for (const control of [retry, inbox]) assert.ok(minHeightOf(control) >= 48);
    (inbox.props.onPress as () => void)();
    assert.equal(opened, true);
    const unavailable = { isHistoryAvailable: false } as CalendarView;
    const empty = render("mobile/src/features/calendar/CalendarDayEmpty.tsx", "CalendarDayEmpty", {
      view: unavailable,
      hasError: false,
    });
    assert.ok(!texts(empty).includes(m["mobile.calendar.noActivity"]));
    const available = render(
      "mobile/src/features/calendar/CalendarDayEmpty.tsx",
      "CalendarDayEmpty",
      {
        view: { isHistoryAvailable: true },
        hasError: false,
      },
    );
    assert.ok(texts(available).includes(m["mobile.calendar.noActivity"]));
    assertReadable([...notices, ...available]);
  }
});

void test("P33 route action: 'Ver recorrido' with lines, otherwise why there is none", () => {
  const { render } = componentHarness({ locale: "es-MX", scheme: "light", fontScale: 1.3 });
  const m = messages["es-MX"];
  const route = (value: string) =>
    render("mobile/src/features/calendar/DayRouteAction.tsx", "DayRouteAction", {
      route: value,
      onOpen: () => undefined,
    });
  const button = pressables(route("lines"))[0];
  assert.equal(button?.props.accessibilityLabel, m["mobile.calendar.seeRoute"]);
  assert.ok(minHeightOf(button) >= 48);
  assert.ok(texts(route("pruned")).includes(m["mobile.calendar.routePruned"]));
  assert.ok(texts(route("none")).includes(m["mobile.calendar.noRoute"]));
  assert.deepEqual(route("hidden"), []);
  // The day's own shift.open tells a pruned route from a day without one.
  assert.equal(dayRouteOf(null, true), "loading");
  assert.equal(
    dayRouteOf(
      [
        [
          [-89.6, 21],
          [-89.6, 22],
        ],
      ],
      false,
    ),
    "lines",
  );
  assert.equal(dayRouteOf([], true), "pruned");
  assert.equal(dayRouteOf([], false), "none");
});

void test("P33 an open calendar re-reads once the organization's date changes (midnight)", () => {
  const view = { today: TODAY, timeZone: "America/Merida" } as CalendarView;
  // 23:59 and 00:01 in Merida (UTC-6).
  assert.equal(isStaleDay(view, new Date("2026-11-26T05:59:00Z")), false);
  assert.equal(isStaleDay(view, new Date("2026-11-26T06:01:00Z")), true);
  assert.equal(isStaleDay(null, new Date("2026-11-26T06:01:00Z")), false);
});
