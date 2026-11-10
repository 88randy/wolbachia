import { describe, expect, it } from "vitest";
import { qrPayload } from "./label-payload";

describe("qrPayload", () => {
  const id = "0A1B2C3D-0000-4000-8000-0123456789AB";
  it("uses the kinds the backend scan parser accepts", () => {
    expect(qrPayload("lots", { id, code: "L-1" })).toBe(
      "wbf:1:lot:0a1b2c3d-0000-4000-8000-0123456789ab",
    );
    expect(qrPayload("bags", { id, code: "B-1" })).toMatch(/^wbf:1:bag:/);
    expect(qrPayload("ovitraps", { id, code: "O-1" })).toMatch(/^wbf:1:ovitrap:/);
  });
  it("carries the human code for paddles and motorcycles", () => {
    expect(qrPayload("paddles", { id, code: "P-7" })).toBe("wbf:1:paddle:P-7");
    expect(qrPayload("motorcycles", { id, code: "M-03" })).toBe("wbf:1:motorcycle:M-03");
  });
});
