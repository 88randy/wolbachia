import { expect, test } from "vitest";
import { chartReadings } from "./condition-chart";
import { conditionReading } from "./test-fixtures";

test("history charts order actual instants and use receipt time for simultaneous observations", () => {
  const earlier = conditionReading({
    id: "earlier",
    device_time: "2026-11-06T14:10:00Z",
    server_received_at: "2026-11-06T14:11:00Z",
  });
  const original = conditionReading({
    id: "original",
    device_time: "2026-11-06T14:15:00Z",
    server_received_at: "2026-11-06T14:16:00Z",
  });
  const delayed = conditionReading({
    id: "delayed",
    device_time: "2026-11-06T08:15:00-06:00",
    server_received_at: "2026-11-06T09:00:00-06:00",
  });
  expect(chartReadings([delayed, original, earlier], "temperature").map((row) => row.id)).toEqual([
    "earlier",
    "original",
    "delayed",
  ]);
});
