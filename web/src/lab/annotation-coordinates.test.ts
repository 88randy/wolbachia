import { describe, expect, test } from "vitest";
import {
  clampMark,
  createBox,
  fitViewport,
  boxCorners,
  hitResizeCorner,
  imageToScreen,
  moveMark,
  resizeBox,
  screenToImage,
  zoomViewport,
} from "./annotation-coordinates";

describe("annotation image coordinates", () => {
  test.each([1, 0.25])("chooses the nearest small-box corner at scale %s", (scale) => {
    const box = { kind: "box", x: 100, y: 100, w: 12, h: 24 } as const;
    for (const [corner, point] of Object.entries(boxCorners(box))) {
      expect(hitResizeCorner(box, point, 12 / scale)).toBe(corner);
    }
    expect(hitResizeCorner(box, { x: 200, y: 200 }, 12 / scale)).toBeUndefined();
  });

  test("round trips image pixels through zoom and pan", () => {
    const viewport = { scale: 2.5, x: -250, y: 44 };
    const pixel = { x: 1430, y: 540 };
    expect(screenToImage(imageToScreen(pixel, viewport), viewport)).toEqual(pixel);
  });

  test("keeps the cursor's image pixel fixed while zooming", () => {
    const viewport = { scale: 0.25, x: 10, y: 15 };
    const cursor = { x: 170, y: 130 };
    const zoomed = zoomViewport({ viewport, anchor: cursor, scale: 1.5 });
    expect(screenToImage(cursor, zoomed)).toEqual(screenToImage(cursor, viewport));
  });

  test("fits a 4096 image and clamps integer marks at image edges", () => {
    const image = { width: 4096, height: 2048 };
    const fitted = fitViewport({ image, size: { width: 1024, height: 768 } });
    expect(fitted).toEqual({ scale: 0.25, x: 0, y: 128 });
    expect(clampMark({ kind: "point", x: -2.5, y: 3000 }, image)).toEqual({
      kind: "point",
      x: 0,
      y: 2047,
    });
    expect(clampMark({ kind: "box", x: 4094, y: 2040, w: 20, h: 20 }, image)).toEqual({
      kind: "box",
      x: 4094,
      y: 2040,
      w: 2,
      h: 8,
    });
  });

  test("normalizes reverse box drags and preserves box size when moving to an edge", () => {
    const image = { width: 100, height: 100 };
    const box = createBox({ start: { x: 20, y: 30 }, end: { x: 10, y: 5 }, image });
    expect(box).toEqual({ kind: "box", x: 10, y: 5, w: 10, h: 25 });
    expect(moveMark({ mark: box, delta: { x: 200, y: -200 }, image })).toEqual({
      kind: "box",
      x: 90,
      y: 0,
      w: 10,
      h: 25,
    });
    expect(resizeBox({ box, corner: "nw", point: { x: 0, y: 0 }, image })).toEqual({
      kind: "box",
      x: 0,
      y: 0,
      w: 20,
      h: 30,
    });
  });
});
