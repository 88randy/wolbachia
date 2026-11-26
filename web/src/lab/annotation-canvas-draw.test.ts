import { afterEach, expect, test, vi } from "vitest";
import { drawMarksLayer } from "./annotation-canvas-draw";

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([0.25, 2])("draws adjustable square grid cells in image pixels at zoom %s", (scale) => {
  const canvas = document.createElement("canvas");
  const context = {
    canvas,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const layer = {
    canvas,
    size: { width: 600, height: 600 },
    viewport: { x: 40, y: 70, scale },
    image: { width: 1000, height: 700 },
    marks: [],
    selected: -1,
    color: "blue",
    showGrid: true,
  };
  drawMarksLayer({ ...layer, gridSize: 200 });
  expect(context.translate).toHaveBeenCalledWith(40, 70);
  expect(context.scale).toHaveBeenCalledWith(scale, scale);
  expect(context.moveTo.mock.calls).toEqual([
    [200, 0],
    [400, 0],
    [600, 0],
    [800, 0],
    [0, 200],
    [0, 400],
    [0, 600],
  ]);
  expect(context.lineTo.mock.calls).toEqual([
    [200, 700],
    [400, 700],
    [600, 700],
    [800, 700],
    [1000, 200],
    [1000, 400],
    [1000, 600],
  ]);
  context.moveTo.mockClear();
  drawMarksLayer({ ...layer, gridSize: 310 });
  expect(context.moveTo.mock.calls).toEqual([
    [310, 0],
    [620, 0],
    [930, 0],
    [0, 310],
    [0, 620],
  ]);
});

test.each([0.25, 1, 4])(
  "draws outlined boxes, filled points and selection handles at constant screen sizes at zoom %s",
  (scale) => {
    const canvas = document.createElement("canvas");
    const context = {
      canvas,
      lineWidth: 0,
      strokeStyle: "",
      fillStyle: "",
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      moveTo: vi.fn(),
      arc: vi.fn<CanvasRenderingContext2D["arc"]>(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn<CanvasRenderingContext2D["fillRect"]>(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    };
    const strokes: { width: number; color: string }[] = [];
    context.stroke.mockImplementation(() => {
      strokes.push({ width: context.lineWidth * scale, color: context.strokeStyle });
    });
    canvas.style.setProperty("--color-on-action", "white");
    vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    drawMarksLayer({
      canvas,
      size: { width: 600, height: 600 },
      viewport: { x: 0, y: 0, scale },
      image: { width: 1000, height: 1000 },
      marks: [
        { kind: "box", x: 10, y: 20, w: 12, h: 24 },
        { kind: "point", x: 40, y: 50 },
      ],
      selected: 0,
      color: "blue",
      showGrid: false,
    });
    expect(strokes.slice(0, 2)).toEqual([
      { width: 4, color: "white" },
      { width: 2, color: "blue" },
    ]);
    expect((context.arc.mock.calls[0]?.[2] ?? 0) * scale).toBe(4);
    expect(context.fill).toHaveBeenCalledOnce();
    expect(context.fillRect.mock.calls).toHaveLength(4);
    for (const handle of context.fillRect.mock.calls) {
      expect(handle[2] * scale).toBe(8);
      expect(handle[3] * scale).toBe(8);
    }
  },
);
