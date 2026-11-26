import assert from "node:assert/strict";
import { test } from "node:test";
import { CalendarReads } from "../src/features/calendar/calendar-reads.ts";
import type { CalendarView } from "../src/features/calendar/service.ts";
import { deferred } from "./support/auth-fakes.ts";

const KEY = '["owner-a","session-a"]';
const viewFor = (identityKey: string | null, today: string) =>
  ({ identityKey, today }) as unknown as CalendarView;

/** Each `read()` returns the next deferred promise, settled by the test in any order. */
function fakeCalendar() {
  const session = { key: KEY as string | null };
  const pending: ReturnType<typeof deferred<CalendarView>>[] = [];
  return {
    session,
    pending,
    calendar: {
      identityKey: () => session.key,
      read: () => {
        const next = deferred<CalendarView>();
        pending.push(next);
        return next.promise;
      },
    },
  };
}

void test("P33 a late older read never overwrites a newer one", async () => {
  const { calendar, pending } = fakeCalendar();
  const reads = new CalendarReads(calendar);
  const older = reads.load();
  const newer = reads.load();
  pending[1]?.resolve(viewFor(KEY, "newer"));
  await newer;
  pending[0]?.resolve(viewFor(KEY, "older"));
  await older;

  assert.equal(reads.getSnapshot().view?.today, "newer");
});

void test("P33 revoke, then a failed read, leaves no private view", async () => {
  const { calendar, pending, session } = fakeCalendar();
  const reads = new CalendarReads(calendar);
  const first = reads.load();
  pending[0]?.resolve(viewFor(KEY, "first"));
  await first;

  session.key = null;
  reads.hide();
  assert.equal(reads.getSnapshot().view, null, "hidden synchronously");
  const failing = reads.load();
  pending[1]?.reject(new Error("read failed"));
  await failing;

  assert.deepEqual(reads.getSnapshot(), { view: null, hasError: true });
});

void test("P33 a failed read keeps the last view only for the same identity", async () => {
  const { calendar, pending, session } = fakeCalendar();
  const reads = new CalendarReads(calendar);
  const first = reads.load();
  pending[0]?.resolve(viewFor(KEY, "first"));
  await first;

  const sameIdentity = reads.load();
  pending[1]?.reject(new Error("read failed"));
  await sameIdentity;
  assert.equal(reads.getSnapshot().view?.today, "first");
  assert.equal(reads.getSnapshot().hasError, true);

  const changedIdentity = reads.load();
  session.key = '["owner-b","session-b"]';
  pending[2]?.reject(new Error("read failed"));
  await changedIdentity;
  assert.deepEqual(reads.getSnapshot(), { view: null, hasError: true });
});
