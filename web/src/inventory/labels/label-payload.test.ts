import { describe, expect, it } from "vitest";
import { qrPayload } from "./label-payload";

describe("qrPayload", () => {
  const id = "0A1B2C3D-0000-4000-8000-0123456789AB";
  it("uses the kinds the backend scan parser accepts", () => {
    expect(qrPayload("lots", id)).toBe("wbf:1:lot:0a1b2c3d-0000-4000-8000-0123456789ab");
    expect(qrPayload("bags", id)).toMatch(/^wbf:1:bag:/);
    expect(qrPayload("ovitraps", id)).toMatch(/^wbf:1:ovitrap:/);
  });
  it("names paddles and motorcycles with their own kind", () => {
    expect(qrPayload("paddles", id)).toMatch(/^wbf:1:paddle:/);
    expect(qrPayload("motorcycles", id)).toMatch(/^wbf:1:motorcycle:/);
  });
});
