import assert from "node:assert/strict";
import { test } from "node:test";
import { newReceiptDraft } from "../src/features/supply-receipt/new-draft.ts";
import { readSupplyAssignment } from "../src/features/supply-receipt/projection-contract.ts";
import {
  isMeaningfulSignature,
  SIGNATURE_HEIGHT,
  SIGNATURE_WIDTH,
  signaturePoint,
} from "../src/features/supply-receipt/signature-path.ts";
import { supplyName } from "../src/features/supply-receipt/supply-name.ts";
import { ownerKey } from "../src/attachments/types.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import { receiptId, supplyAssignment } from "./support/m-05-fixtures.ts";

// The pad sits lower on the screen: its own layout x/y must never leak into the touch.
const PAD = { x: 16, y: 412, width: 352, height: 176 };

/** Responder events as the pad receives them (pad-relative locationX/Y). */
function stroke(touches: readonly (readonly [number, number])[]): string {
  const points = touches.map(([locationX, locationY]) => {
    const nativeEvent = {
      locationX,
      locationY,
      pageX: PAD.x + locationX,
      pageY: PAD.y + locationY,
    };
    return signaturePoint(nativeEvent, PAD);
  });
  return `M${points.join(" L")}`;
}

void test("a finger stroke keeps every distinct point under the finger, scaled into the pad", () => {
  const path = stroke([
    [0, 0],
    [88, 44],
    [176, 88],
    [264, 132],
    [352, 176],
  ]);
  assert.equal(path, "M0,0 L80,40 L160,80 L240,120 L320,160");
});

void test("on a pad that is not 2:1, the per-axis (preserveAspectRatio none) render lands under the finger", () => {
  const pad = { width: 343, height: 160 };
  for (const [locationX, locationY] of [
    [10, 150],
    [171, 80],
    [333, 7],
  ] as const) {
    const [x, y] = signaturePoint({ locationX, locationY }, pad).split(",").map(Number);
    // Rendering a viewBox point stretched per axis; rounding keeps it within 1 px of the touch.
    assert.ok(Math.abs(((x ?? 0) * pad.width) / SIGNATURE_WIDTH - locationX) <= 1);
    assert.ok(Math.abs(((y ?? 0) * pad.height) / SIGNATURE_HEIGHT - locationY) <= 1);
  }
});

void test("a tap (a dot or a few jittered points) never enables saving", () => {
  assert.equal(isMeaningfulSignature([]), false);
  assert.equal(isMeaningfulSignature([stroke([[40, 30]])]), false);
  assert.equal(
    isMeaningfulSignature([
      stroke([
        [40, 30],
        [41, 31],
        [42, 30],
        [41, 29],
        [43, 32],
        [40, 31],
      ]),
    ]),
    false,
  );
  // Many identical points (the old collapsed signature) are still a dot.
  assert.equal(isMeaningfulSignature([stroke(Array(50).fill([16, 412] as const))]), false);
});

void test("a real stroke enables saving, also when built from several short strokes", () => {
  const line = Array.from({ length: 12 }, (_, index) => [20 + index * 10, 60] as const);
  assert.equal(isMeaningfulSignature([stroke(line)]), true);
  const short = (from: number) =>
    stroke([
      [from, 80],
      [from + 10, 82],
      [from + 20, 84],
    ]);
  assert.equal(isMeaningfulSignature([short(20)]), false);
  assert.equal(isMeaningfulSignature([short(20), short(60)]), true);
});

void test("the supply name survives the bundle decoder and labels the counted line", () => {
  const sent = supplyAssignment();
  const decoded = readSupplyAssignment({
    ...sent,
    lines: sent.lines.map((row) => ({ ...row, name: "Ovitrampa negra" })),
  });
  const draft = newReceiptDraft({
    assignment: decoded,
    releaseId: receiptId(8),
    ownerKey: ownerKey(PROJECTION_IDENTITY.owner),
    shiftId: receiptId(50),
    versions: { rules: "r", catalog: "c", signatureMode: 2 },
    now: new Date("2026-11-11T12:00:00Z"),
    uuid: () => receiptId(300),
  });
  const [line] = draft.lines;
  assert.ok(line);
  assert.equal(supplyName([decoded], decoded.id, line), "Ovitrampa negra");
  assert.equal(supplyName([readSupplyAssignment(sent)], decoded.id, line), null);
});
