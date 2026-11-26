import { expect, test } from "vitest";
import { positionAge, STALE_AFTER_MINUTES, trackLines } from "./track-model";

const RECORDED = "2026-11-24T15:00:00Z";
const at = (seconds: number) => Date.parse(RECORDED) + seconds * 1000;

test("a position turns stale only after two upload intervals (10 min by default)", () => {
  expect(STALE_AFTER_MINUTES).toBe(10);
  expect(positionAge(RECORDED, at(600))).toEqual({ minutes: 10, isStale: false });
  expect(positionAge(RECORDED, at(601))).toEqual({ minutes: 10, isStale: true });
  // A phone clock ahead of ours never shows a negative age.
  expect(positionAge(RECORDED, at(-90))).toEqual({ minutes: 0, isStale: false });
});

test("each segment is its own [lng, lat] line, so a gap is never drawn as a jump", () => {
  const segment = (id: string, positions: number[][]) => ({
    id,
    started_at: RECORDED,
    ended_at: RECORDED,
    received_at: RECORDED,
    positions,
  });
  const lines = trackLines([
    segment("a", [
      [0, 19.4, -99.1, 8],
      [30, 19.41, -99.11, 9],
    ]),
    segment("empty", []),
    segment("b", [[0, 19.5, -99.2, 7]]),
  ]);
  expect(lines).toEqual([
    [
      [-99.1, 19.4],
      [-99.11, 19.41],
    ],
    [[-99.2, 19.5]],
  ]);
});
