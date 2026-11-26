import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { screenToImage } from "./annotation-coordinates";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import { EggAnnotationSurface } from "./EggAnnotationSurface";
import { useAnnotationCanvas } from "./use-annotation-canvas";

vi.mock("./use-annotation-drawing", () => ({ useAnnotationDrawing: () => undefined }));

let resize: ResizeObserverCallback;
let control: ReturnType<typeof useAnnotationCanvas>;

function Harness(props: AnnotationCanvasProps) {
  control = useAnnotationCanvas(props);
  return <EggAnnotationSurface control={control} hintId="hint" tool={props.tool} />;
}

function sizeCanvas(width: number, height = width) {
  act(() => {
    resize([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function openCanvas(overrides: Partial<AnnotationCanvasProps> = {}) {
  const i18n = await setupI18n("es-MX");
  const props: AnnotationCanvasProps = {
    image: { src: "blob:first", width: 1000, height: 1000 },
    marks: [{ kind: "box", x: 100, y: 100, w: 12, h: 24 }],
    tool: "select",
    defaultBox: { width: 12, height: 24 },
    markerColor: "var(--color-action)",
    showGrid: false,
    onMarksChange: vi.fn(),
    ...overrides,
  };
  const result = render(
    <I18nextProvider i18n={i18n}>
      <Harness {...props} />
    </I18nextProvider>,
  );
  return {
    ...result,
    props,
    canvas: screen.getByLabelText("Foto de la papeleta y marcas de huevos"),
  };
}

test.each([1, 0.25])(
  "selecting and clicking every corner at scale %s never commits",
  async (scale) => {
    const { canvas, props } = await openCanvas();
    sizeCanvas(1000 * scale);
    for (const [x, y] of [
      [100, 100],
      [112, 100],
      [100, 124],
      [112, 124],
    ] as const) {
      for (const offset of [0, 2]) {
        fireEvent.pointerDown(canvas, { clientX: x * scale, clientY: y * scale });
        fireEvent.pointerUp(canvas, { clientX: x * scale + offset, clientY: y * scale });
      }
    }
    expect(props.onMarksChange).not.toHaveBeenCalled();
  },
);

test("resizing the container preserves scale and the centered image pixel; a new image refits", async () => {
  const { rerender, props } = await openCanvas();
  sizeCanvas(1000);
  act(() => {
    control.surface.setViewport({ scale: 2, x: -250, y: -100 });
  });
  const centered = screenToImage({ x: 500, y: 500 }, control.surface.viewport);
  sizeCanvas(700, 600);
  expect(control.surface.viewport.scale).toBe(2);
  expect(screenToImage({ x: 350, y: 300 }, control.surface.viewport)).toEqual(centered);
  const i18n = await setupI18n("es-MX");
  rerender(
    <I18nextProvider i18n={i18n}>
      <Harness {...props} image={{ ...props.image, src: "blob:second" }} />
    </I18nextProvider>,
  );
  sizeCanvas(700, 600);
  expect(control.surface.viewport).toEqual({ scale: 0.6, x: 50, y: 0 });
});

test.each(["select", "box", "point", "pan"] as const)(
  "a right drag pans without deleting marks with the %s tool",
  async (tool) => {
    const { canvas, props } = await openCanvas({ tool });
    sizeCanvas(1000);
    fireEvent.pointerDown(canvas, { clientX: 105, clientY: 105, button: 2 });
    fireEvent.contextMenu(canvas, { clientX: 105, clientY: 105 });
    fireEvent.pointerMove(canvas, { clientX: 107, clientY: 105, button: 2 });
    expect(control.surface.viewport).toEqual({ scale: 1, x: 0, y: 0 });
    fireEvent.pointerMove(canvas, { clientX: 145, clientY: 130, button: 2 });
    expect(control.surface.viewport).toEqual({ scale: 1, x: 40, y: 25 });
    fireEvent.pointerUp(canvas, { clientX: 145, clientY: 130, button: 2 });
    fireEvent.contextMenu(canvas, { clientX: 145, clientY: 130 });
    expect(props.onMarksChange).not.toHaveBeenCalled();
  },
);

test.each([0, 2])(
  "a right click with %s px of motion deletes only on release, below the existing click threshold",
  async (offset) => {
    const { canvas, props } = await openCanvas();
    sizeCanvas(1000);
    fireEvent.pointerDown(canvas, { clientX: 105, clientY: 105, button: 2 });
    fireEvent.contextMenu(canvas, { clientX: 105, clientY: 105 });
    expect(props.onMarksChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas, { clientX: 105 + offset, clientY: 105, button: 2 });
    expect(props.onMarksChange).toHaveBeenCalledExactlyOnceWith([]);
  },
);

test("a right drag that returns to its start preserves marks", async () => {
  const { canvas, props } = await openCanvas();
  sizeCanvas(1000);
  fireEvent.pointerDown(canvas, { clientX: 105, clientY: 105, button: 2 });
  fireEvent.pointerMove(canvas, { clientX: 108, clientY: 105, button: 2 });
  expect(control.surface.viewport.x).toBe(3);
  fireEvent.pointerMove(canvas, { clientX: 105, clientY: 105, button: 2 });
  fireEvent.pointerUp(canvas, { clientX: 105, clientY: 105, button: 2 });
  expect(props.onMarksChange).not.toHaveBeenCalled();
});

test("context menus are suppressed without changing marks", async () => {
  const { canvas, props } = await openCanvas();
  sizeCanvas(1000);
  const contextMenu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  fireEvent(canvas, contextMenu);
  expect(contextMenu.defaultPrevented).toBe(true);
  expect(props.onMarksChange).not.toHaveBeenCalled();
});

test.each(["pointercancel", "lostpointercapture"])(
  "%s retires a right press before any later release can delete",
  async (eventName) => {
    const { canvas, props } = await openCanvas();
    sizeCanvas(1000);
    fireEvent.pointerDown(canvas, { clientX: 105, clientY: 105, button: 2 });
    fireEvent(canvas, new PointerEvent(eventName, { bubbles: true, pointerId: 1 }));
    fireEvent.pointerUp(canvas, { clientX: 105, clientY: 105, button: 2 });
    expect(props.onMarksChange).not.toHaveBeenCalled();
  },
);

test("a touch long-press context menu preserves marks", async () => {
  const { canvas, props } = await openCanvas();
  sizeCanvas(1000);
  fireEvent.pointerDown(canvas, { clientX: 105, clientY: 105, pointerType: "touch" });
  fireEvent.contextMenu(canvas, { clientX: 105, clientY: 105 });
  expect(props.onMarksChange).not.toHaveBeenCalled();
  fireEvent.pointerUp(canvas, { clientX: 105, clientY: 105, pointerType: "touch" });
  fireEvent.contextMenu(canvas, { clientX: 105, clientY: 105 });
  expect(props.onMarksChange).not.toHaveBeenCalled();
});
