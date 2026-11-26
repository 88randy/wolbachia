import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import { buildCalendar } from "../src/features/calendar/domain.ts";
import type { CalendarItem } from "../src/features/calendar/domain.ts";
import { foldDecisions, historyTitleKey } from "../src/features/history/domain.ts";
import type { HistoryEntry } from "../src/features/history/domain.ts";
import { componentHarness } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const SOURCE = "00000000-0000-4000-8000-000000000101";
const own = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: SOURCE,
  kind: "ovitrap.replace",
  sourceId: SOURCE,
  shiftId: null,
  time: "2026-11-25T17:31:00.000Z", // 11:31 in Merida
  codes: ["Q-MER-01-B1-P1"],
  status: "in_review",
  reason: null,
  author: "courier",
  voidsId: null,
  isServerDecision: false,
  observation: null,
  ...overrides,
});
const decision = (id: string, status: HistoryEntry["status"], time: string): HistoryEntry => ({
  ...own(),
  id: `review_decision:${id}`,
  kind: "review_decision",
  time,
  status,
  reason: `office ${id}`,
  author: "supervisor",
  isServerDecision: true,
});
const dayItems = (entries: readonly HistoryEntry[]) =>
  buildCalendar({
    entries: foldDecisions(entries),
    unscoped: [],
    tasks: [],
    timeZone: "America/Merida",
    epiWeek: "iso",
    today: "2026-11-25",
  }).days.find((day) => day.date === "2026-11-25")?.items ?? [];
const render = componentHarness({ locale: "es-MX", scheme: "light", fontScale: 1.3 }).render;
const rowOf = (item: CalendarItem): readonly RenderNode[] =>
  render("mobile/src/features/calendar/CalendarItemRow.tsx", "CalendarItemRow", {
    item,
    time: "11:31",
    onOpenInbox: () => undefined,
  });
const texts = (nodes: readonly RenderNode[]) =>
  nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
const m = messages["es-MX"];

void test("P33 an approved in-review replace is one 'Aceptado' row without the inbox link", () => {
  const items = dayItems([own(), decision("a", "reviewed", "2026-11-25T19:43:00.000Z")]);
  assert.deepEqual(
    items.map((item) => [item.id, item.status]),
    [[SOURCE, "reviewed"]],
  );
  const [item] = items;
  assert.ok(item);
  const nodes = rowOf(item);
  assert.ok(texts(nodes).includes(m["mobile.calendar.statusAccepted"]));
  assert.ok(texts(nodes).includes(m["mobile.eventType.ovitrapReplace"]), "titled by its own type");
  assert.equal(nodes.filter((node) => node.type === "Pressable").length, 0, "no 'Ver en Bandeja'");
});

void test("P33 a voided in-review replace is one struck-through 'Anulado' row", () => {
  const items = dayItems([own(), decision("v", "voided", "2026-11-25T18:57:00.000Z")]);
  assert.equal(items.length, 1);
  const [item] = items;
  assert.ok(item);
  assert.equal(item.status, "voided");
  const nodes = rowOf(item);
  assert.equal(nodes.find((node) => node.type === "Text")?.props.className, "line-through");
  assert.ok(texts(nodes).includes(m["mobile.history.voided"]));
  assert.equal(nodes.filter((node) => node.type === "Pressable").length, 0);
});

void test("P29/P33 with two decisions the later one wins, whatever their order", () => {
  const voided = decision("v", "voided", "2026-11-25T18:57:00.000Z");
  const approved = decision("a", "reviewed", "2026-11-25T19:43:00.000Z");
  for (const entries of [
    [own(), voided, approved],
    [approved, own(), voided],
  ]) {
    const folded = foldDecisions(entries);
    assert.deepEqual(
      folded.map((entry) => [entry.id, entry.status, entry.reason, entry.author]),
      [[SOURCE, "reviewed", "office a", "supervisor"]],
    );
  }
});

void test("P29/P33 a decision without a visible own original keeps its row, titled by type when known", () => {
  const orphan = { ...decision("o", "voided", "2026-11-25T18:57:00.000Z"), sourceId: "other" };
  const relocation = {
    ...decision("r", "rejected", "2026-11-25T18:00:00.000Z"),
    kind: "relocation_proposal",
    sourceId: "hidden-by-scope",
  };
  const pending = { ...decision("p", "in_review", "2026-11-25T18:30:00.000Z") };
  const lab = { ...decision("l", "voided", "2026-11-25T20:00:00.000Z"), kind: "lab_void" };
  const folded = foldDecisions([own(), orphan, relocation, pending, lab]);
  assert.deepEqual(
    folded.map((entry) => [entry.id, entry.status]),
    [
      [SOURCE, "in_review"],
      [orphan.id, "voided"],
      [relocation.id, "rejected"],
      [pending.id, "in_review"],
      [lab.id, "voided"],
    ],
    "only review/relocation verdicts fold; in-review facts and lab facts stay rows",
  );
  assert.equal(historyTitleKey("relocation_proposal"), "mobile.eventType.ovitrapRelocate");
  assert.equal(historyTitleKey("community_activity"), "mobile.eventType.communityActivity");
  assert.equal(historyTitleKey("review_decision"), "mobile.history.serverFact");
  assert.equal(historyTitleKey("ovitrap.replace"), "mobile.eventType.ovitrapReplace");
});

void test("P29 card of a folded row shows its own type and the decision status", () => {
  const [entry] = foldDecisions([own(), decision("a", "reviewed", "2026-11-25T19:43:00.000Z")]);
  const nodes = render("mobile/src/features/history/HistoryCard.tsx", "HistoryCard", {
    entry,
    formattedTime: "11:31",
  });
  assert.ok(texts(nodes).includes(m["mobile.eventType.ovitrapReplace"]));
  assert.ok(texts(nodes).includes(m["mobile.calendar.statusAccepted"]));
});
