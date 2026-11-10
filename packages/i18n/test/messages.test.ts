import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultLocale, messages } from "../src/index.ts";
import type { Locale } from "../src/index.ts";

const KEY_CONVENTION = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
const STRAY_BRACE = /[{}]/;

const locales = Object.keys(messages) as Locale[];

/**
 * Messages that take a placeholder, sorted by key. A new one is added here on purpose: the
 * wording around a number or a noun must not need plural or gender agreement (see the README).
 * `table.*` fill in the range, the count, a translated column header or filter name, and a row
 * name the screen provides; each sentence reads the same for 1 and for many.
 * `rules.*` fill in a formatted date, a formatted bound of the allowed range and a short user
 * reference; none needs plural or gender agreement.
 * `voiding.*` fill in a count, the configured length limits, a record code and the reason or
 * author of a void; the minimum is 10 by default, so no sentence has a singular form.
 */
const ALLOWED_PLACEHOLDERS: readonly (readonly [string, readonly string[]])[] = [
  ["auth.lockout.message", ["minutes"]],
  ["catalogs.actions.movedDown", ["name"]],
  ["catalogs.actions.moveDown", ["name"]],
  ["catalogs.actions.movedUp", ["name"]],
  ["catalogs.actions.moveUp", ["name"]],
  ["catalogs.confirm.title", ["name"]],
  ["closure.blocker.reference", ["reference"]],
  ["closure.blocker.unblocker", ["permission"]],
  ["closure.blocker.unknown", ["reason"]],
  ["closure.page.title", ["code"]],
  ["closure.readiness.version", ["revision", "version"]],
  ["closure.receipt.audit", ["author", "time"]],
  ["closure.receipt.reference", ["reference"]],
  ["discrepancies.close.reasonHint", ["min"]],
  ["errors.api.blocked", ["role"]],
  ["fleet.clear.reasonLimits", ["max", "min"]],
  ["fleet.clear.title", ["record"]],
  ["fleet.efficiency.thresholds", ["max", "min"]],
  ["fleet.efficiency.value", ["value"]],
  ["fleet.history.reference", ["id"]],
  ["fleet.unblock.title", ["record"]],
  ["fleet.write.readback", ["revision"]],
  ["geography.retire.author", ["author"]],
  ["geography.retire.dialogTitle", ["record"]],
  ["incidents.evidence.download", ["id"]],
  ["incidents.workspace.eventState", ["owner", "revision", "severity", "state"]],
  ["incidents.workspace.requiredEvidence", ["count"]],
  ["mobile.chip.noSignal", ["count"]],
  ["mobile.chip.toUpload", ["count"]],
  ["mobile.day.block", ["code"]],
  ["mobile.day.coordinates", ["coordinates"]],
  ["mobile.day.distance", ["distance"]],
  ["mobile.day.errorCode", ["code"]],
  ["mobile.day.historyEntry", ["date", "summary"]],
  ["mobile.day.keptNotice", ["codes"]],
  ["mobile.day.locationFix", ["accuracy", "seconds"]],
  ["mobile.day.locationStale", ["seconds"]],
  ["mobile.day.locationUnknownAccuracy", ["seconds"]],
  ["mobile.day.locationWeak", ["accuracy", "seconds"]],
  ["mobile.day.progress", ["completed", "total"]],
  ["mobile.day.reference", ["reference"]],
  ["mobile.day.unreadable", ["count"]],
  ["mobile.inbox.evidencePending", ["count"]],
  ["mobile.inbox.groupTitle", ["count", "label"]],
  ["mobile.inbox.lastConnection", ["time"]],
  ["mobile.inbox.onPhone", ["count"]],
  ["mobile.inbox.sent", ["count"]],
  ["mobile.inbox.timeRange", ["from", "to"]],
  ["mobile.lifecycle.advisoryAt", ["at"]],
  ["mobile.lifecycle.advisoryCounts", ["incidents", "weeks"]],
  ["mobile.lifecycle.reasonLimits", ["max", "min"]],
  ["mobile.lifecycle.sourceVoided", ["at"]],
  ["mobile.login.throttled", ["minutes"]],
  ["mobile.login.version", ["version"]],
  ["mobile.unlock.greeting", ["name"]],
  ["mobile.unlock.passwordRequired", ["count"]],
  ["mobile.unlock.pinProgress", ["count"]],
  ["mobile.unlock.wrongPin", ["count"]],
  ["refresh.reorder.position", ["count"]],
  ["reviews.workspace.blocker", ["code"]],
  ["reviews.workspace.incidentReceipt", ["id"]],
  ["reviews.workspace.open", ["id"]],
  ["reviews.workspace.reasonHint", ["min"]],
  ["rules.compare.from", ["date"]],
  ["rules.error.atLeast", ["min"]],
  ["rules.error.atMost", ["max"]],
  ["rules.error.range", ["max", "min"]],
  ["rules.form.scheduledNote", ["date"]],
  ["rules.history.voidLabel", ["date"]],
  ["rules.range.atLeast", ["min"]],
  ["rules.range.atMost", ["max"]],
  ["rules.range.between", ["max", "min"]],
  ["shift.field.reasonHint", ["max", "min"]],
  ["table.filters.ignoredBody", ["names"]],
  ["table.filters.ignoredMore", ["count"]],
  ["table.filters.remove", ["filter", "value"]],
  ["table.pager.position", ["page", "pages"]],
  ["table.selection.count", ["count"]],
  ["table.selection.row", ["row"]],
  ["table.sort.ascending", ["column"]],
  ["table.sort.descending", ["column"]],
  ["table.status.range", ["from", "to", "total"]],
  ["table.status.rangeCursor", ["count"]],
  ["table.voided.author", ["author"]],
  ["table.voided.reason", ["reason"]],
  ["table.voided.when", ["when"]],
  ["transfers.history.evidence", ["role"]],
  ["transfers.history.revision", ["revision"]],
  ["transfers.line.count", ["expected", "received"]],
  ["transfers.line.photo", ["id"]],
  ["transfers.write.committed", ["revision"]],
  ["voiding.dialog.counterBelow", ["count", "min"]],
  ["voiding.dialog.counterOk", ["count", "max"]],
  ["voiding.dialog.minHelp", ["min"]],
  ["voiding.dialog.title", ["record"]],
  ["voiding.error.tooShort", ["min"]],
];

function sortedKeys(locale: Locale): string[] {
  return Object.keys(messages[locale]).sort();
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "").sort();
}

void describe("catalogs", () => {
  void test("es-MX is the default locale", () => {
    assert.equal(defaultLocale, "es-MX");
  });

  void test("es-MX and en have the same keys", () => {
    const spanishKeys = sortedKeys("es-MX");

    const englishKeys = sortedKeys("en");

    assert.deepEqual(englishKeys, spanishKeys);
  });

  void test("es-MX and en use the same placeholders in every message", () => {
    const englishByKey = new Map(Object.entries(messages.en));
    const mismatches = Object.entries(messages["es-MX"]).flatMap(([key, spanish]) => {
      const english = englishByKey.get(key) ?? "";
      const expected = placeholdersOf(spanish);
      const actual = placeholdersOf(english);
      return expected.join() === actual.join()
        ? []
        : [`${key}: es-MX {${expected.join(",")}} vs en {${actual.join(",")}}`];
    });

    assert.deepEqual(mismatches, []);
  });
  void test("only the listed keys take a placeholder, each with exactly the listed ones", () => {
    const withPlaceholders = Object.entries(messages["es-MX"])
      .filter(([, text]) => placeholdersOf(text).length > 0)
      .map(([key, text]) => [key, placeholdersOf(text)] as const)
      .sort(([first], [second]) => first.localeCompare(second));

    assert.deepEqual(withPlaceholders, ALLOWED_PLACEHOLDERS);
  });

  void test("every key follows area.screen.element", () => {
    const invalid = sortedKeys("es-MX").filter((key) => !KEY_CONVENTION.test(key));

    assert.deepEqual(invalid, []);
  });

  for (const locale of locales) {
    void test(`${locale}: messages are not empty and have no unbalanced braces`, () => {
      const invalid = Object.entries(messages[locale]).filter(([, text]) => {
        const withoutPlaceholders = text.replace(PLACEHOLDER, "");
        return text.trim() === "" || STRAY_BRACE.test(withoutPlaceholders);
      });

      assert.deepEqual(invalid, []);
    });
  }
});
