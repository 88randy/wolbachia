import { expect, test } from "vitest";
import { OLD_TRAP_ID, TRAP_ID, makeEntry, makeReading, makeTrap } from "./point-fixtures";
import { buildHistory, currentOvitrap, pointBags } from "./point-history";

const old = makeTrap({ id: OLD_TRAP_ID, code: "OVT-0041", is_retired: true });

test("movements and checks share one list, newest first, with the ovitrap codes", () => {
  const rows = buildHistory(
    [
      makeEntry(),
      makeEntry({
        event_id: "00000000-0000-4000-8000-0000000000c2",
        type: "ovitrap.replace",
        device_time: "2026-11-05T10:00:00Z",
        payload: { ovitrap_id: OLD_TRAP_ID, replacement_id: TRAP_ID },
      }),
      makeEntry({ event_id: "00000000-0000-4000-8000-0000000000c3", type: "record.void" }),
    ],
    [makeReading()],
    [makeTrap(), old],
  );
  expect(rows.map((row) => row.kind)).toEqual(["check", "replace", "place"]);
  expect(rows[1]).toMatchObject({ ovitrapCode: "OVT-0041", nextCode: "OVT-0042" });
  expect(rows[0]).toMatchObject({ ovitrapCode: "OVT-0042", eggs: "yes", by: "Luis Repartidor" });
});

test("the egg answer of a check says when there was no paddle", () => {
  const [row] = buildHistory([], [makeReading({ paddle_present: false, has_eggs: null })], []);
  expect(row?.eggs).toBe("noPaddle");
  expect(row?.ovitrapCode).toBeNull();
});

test("voided records stay in the list with their reason", () => {
  const rows = buildHistory(
    [],
    [makeReading({ voided_at: "2026-11-11T10:00:00Z", void_reason: "Lectura duplicada" })],
    [],
  );
  expect(rows[0]?.voided).toEqual({ reason: "Lectura duplicada" });
});

test("the current ovitrap is the one not retired and not voided", () => {
  expect(currentOvitrap([old, makeTrap()])?.code).toBe("OVT-0042");
  expect(currentOvitrap([old])).toBeNull();
  expect(currentOvitrap([makeTrap({ voided_at: "2026-11-04T10:00:00Z" })])).toBeNull();
});

test("only checks that carried a paddle give a bag, newest first", () => {
  const bags = pointBags([
    makeReading({ bag_code: "B-030", device_time: "2026-11-03T16:00:00Z" }),
    makeReading({ id: "x", bag_code: null, paddle_present: false }),
    makeReading({ id: "y", bag_code: "B-031" }),
  ]);
  expect(bags.map((bag) => bag.code)).toEqual(["B-031", "B-030"]);
});
