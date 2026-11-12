import assert from "node:assert/strict";
import { test } from "node:test";
import { messages } from "@wolbachia/i18n";
import type { Locale } from "@wolbachia/i18n";
import type { HistoryEntry } from "../src/features/history/domain.ts";
import { componentHarness, flattenStyle, minHeightOf } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

const ENTRY: HistoryEntry = {
  id: "synthetic-history",
  kind: "ovitrap.check",
  sourceId: "synthetic-source",
  shiftId: "synthetic-shift",
  time: "2026-11-06T20:00:00Z",
  codes: ["OV-144"],
  status: "in_review",
  reason: "Synthetic retained reviewer observation",
  author: "synthetic-actor",
  voidsId: "synthetic-target",
  isServerDecision: true,
  observation: { es: "Hallazgo archivado", en: "Archived finding" },
};
type Render = ReturnType<typeof componentHarness>["render"];
function texts(nodes: readonly RenderNode[]) {
  return nodes.filter((node) => node.type === "Text").map((node) => node.props.children);
}
function assertHistoryCards(render: Render, locale: Locale) {
  const labels = [
    ["sent", "mobile.history.received"],
    ["reviewed", "mobile.history.reviewed"],
    ["voided", "mobile.history.voided"],
    ["observed", "mobile.history.observed"],
    ["pending", "mobile.status.pending"],
    ["in_review", "sync.inbox.inReviewTitle"],
  ] as const;
  for (const [status, key] of labels) {
    const nodes = render("mobile/src/features/history/HistoryCard.tsx", "HistoryCard", {
      entry: { ...ENTRY, status },
      formattedTime: "06/11/2026",
    });
    const copy = texts(nodes);
    assert.ok(copy.includes(messages[locale][key]));
    assert.ok(copy.includes(`${messages[locale]["mobile.history.reason"]}: ${ENTRY.reason}`));
    // Couriers never see internal ids: the author and the voided target stay out of the card.
    assert.ok(!copy.includes(ENTRY.author));
    assert.ok(!copy.includes(ENTRY.voidsId));
    assert.ok(copy.includes(locale === "en" ? "Archived finding" : "Hallazgo archivado"));
    for (const node of nodes.filter((candidate) => candidate.type === "Text")) {
      assert.equal(node.props.numberOfLines, undefined);
      assert.notEqual(node.props.allowFontScaling, false);
      assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
    }
  }
}
function assertSearchActions(render: Render, locale: Locale) {
  let search = "",
    returned = false;
  const header = render("mobile/src/features/history/HistoryHeader.tsx", "HistoryHeader", {
    model: {
      search: "OV-144",
      setSearch: (value: string) => {
        search = value;
      },
      hasError: true,
      refresh: () => Promise.resolve(),
      isSelected: true,
      backToGroups: () => {
        returned = true;
      },
    },
  });
  const input = header.find((node) => node.type === "TextInput");
  assert.ok(input);
  assert.equal(input.props.accessibilityLabel, messages[locale]["mobile.history.search"]);
  assert.equal(input.props.value, "OV-144");
  (input.props.onChangeText as (value: string) => void)("B-144");
  assert.equal(search, "B-144");
  const controls = header.filter((node) => node.type === "Pressable");
  assert.equal(controls.length, 2);
  for (const control of controls) {
    assert.ok(minHeightOf(control) >= 48);
  }
  const back = controls.find(
    (control) => control.props.accessibilityLabel === messages[locale]["mobile.history.allShifts"],
  );
  assert.ok(back);
  (back.props.onPress as () => void)();
  assert.equal(returned, true);
  assert.ok(texts(header).includes(messages[locale]["mobile.history.failed"]));
}
void test("P29 es-MX/en light/dark host props preserve observations, provenance and search/actions at 130% text", () => {
  for (const locale of ["es-MX", "en"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      assertHistoryCards(render, locale);
      assertSearchActions(render, locale);
    }
});
