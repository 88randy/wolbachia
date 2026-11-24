import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  clampMark,
  createBox,
  hitMark,
  hitResizeCorner,
  isInsideImage,
  moveMark,
  resizeBox,
  screenToImage,
  zoomViewport,
  type AnnotationViewport,
  type BoxCorner,
  type ImagePoint,
} from "./annotation-coordinates";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import { areMarksEqual, MAX_ANNOTATION_MARKS, type AnnotationMark } from "./annotation-state";
import type { useAnnotationSurface } from "./use-annotation-surface";

const POINTER_HIT_RADIUS = 12;
const CLICK_DISTANCE = 3;
type Surface = ReturnType<typeof useAnnotationSurface>;
type PointerInput = ReactPointerEvent<HTMLCanvasElement>;
type Gesture =
  | {
      kind: "pan";
      start: ImagePoint;
      viewport: AnnotationViewport;
      canDelete: boolean;
      hasDragged: boolean;
    }
  | { kind: "box" | "point"; start: ImagePoint; screenStart: ImagePoint }
  | {
      kind: "move" | "resize";
      start: ImagePoint;
      screenStart: ImagePoint;
      index: number;
      mark: AnnotationMark;
      corner?: BoxCorner;
    };

interface PointerOptions {
  props: AnnotationCanvasProps;
  surface: Surface;
  selected: number;
  setSelected: (index: number) => void;
  isSpaceHeld: boolean;
}

export function pointerPosition(
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
): ImagePoint {
  const bounds = canvas.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function selectionGesture(
  options: PointerOptions,
  point: ImagePoint,
  screenStart: ImagePoint,
): Gesture | undefined {
  const { props, surface, selected, setSelected } = options;
  const mark = props.marks[selected];
  const corner =
    mark?.kind === "box"
      ? hitResizeCorner(mark, point, POINTER_HIT_RADIUS / surface.viewport.scale)
      : undefined;
  if (mark && corner)
    return { kind: "resize", start: point, screenStart, index: selected, mark, corner };
  const index = hitMark(props.marks, point, POINTER_HIT_RADIUS / surface.viewport.scale);
  setSelected(index);
  const target = props.marks[index];
  return target ? { kind: "move", start: point, screenStart, index, mark: target } : undefined;
}

function beginGesture(options: PointerOptions, screen: ImagePoint): Gesture | undefined {
  const { props, surface } = options;
  if (!props.onMarksChange || props.tool === "pan" || options.isSpaceHeld) {
    return createPanGesture(surface, screen);
  }
  const point = screenToImage(screen, surface.viewport);
  if (props.tool === "select") return selectionGesture(options, point, screen);
  if (!isInsideImage(point, props.image)) return;
  return { kind: props.tool, start: point, screenStart: screen };
}

function createPanGesture(surface: Surface, start: ImagePoint, canDelete = false): Gesture {
  return { kind: "pan", start, viewport: surface.viewport, canDelete, hasDragged: false };
}

function deleteMarkAt(options: PointerOptions, screen: ImagePoint): void {
  const { props, surface, setSelected } = options;
  if (!props.onMarksChange) return;
  const point = screenToImage(screen, surface.viewport);
  const index = hitMark(props.marks, point, POINTER_HIT_RADIUS / surface.viewport.scale);
  if (index < 0) return;
  props.onMarksChange(props.marks.filter((_, markIndex) => markIndex !== index));
  setSelected(-1);
}

function commitPanGesture(
  options: PointerOptions,
  gesture: Extract<Gesture, { kind: "pan" }>,
  screen: ImagePoint,
): void {
  if (!gesture.canDelete || gesture.hasDragged || hasPointerMoved(gesture.start, screen)) return;
  deleteMarkAt(options, screen);
}

function previewMark(
  gesture: Gesture,
  point: ImagePoint,
  props: AnnotationCanvasProps,
): AnnotationMark | undefined {
  if (gesture.kind === "pan") return;
  if (gesture.kind === "point") return clampMark({ kind: "point", ...point }, props.image);
  if (gesture.kind === "box")
    return createBox({ start: gesture.start, end: point, image: props.image });
  if (gesture.kind === "resize" && gesture.mark.kind === "box" && gesture.corner) {
    return resizeBox({ box: gesture.mark, corner: gesture.corner, point, image: props.image });
  }
  if ("mark" in gesture)
    return moveMark({
      mark: gesture.mark,
      delta: { x: point.x - gesture.start.x, y: point.y - gesture.start.y },
      image: props.image,
    });
  return undefined;
}

function clickMark(gesture: Gesture, props: AnnotationCanvasProps): AnnotationMark | undefined {
  if (gesture.kind === "point") return clampMark({ kind: "point", ...gesture.start }, props.image);
  if (gesture.kind !== "box") return;
  const { width, height } = props.defaultBox;
  return clampMark(
    {
      kind: "box",
      x: gesture.start.x - width / 2,
      y: gesture.start.y - height / 2,
      w: width,
      h: height,
    },
    props.image,
  );
}

function commitGesture(options: PointerOptions, gesture: Gesture, screen: ImagePoint): void {
  const { props, surface, setSelected } = options;
  if (!props.onMarksChange) return;
  if (gesture.kind === "pan") {
    commitPanGesture(options, gesture, screen);
    return;
  }
  const point = screenToImage(screen, surface.viewport);
  const isClick = !hasPointerMoved(gesture.screenStart, screen);
  if (isClick && "index" in gesture) return;
  const mark = isClick ? clickMark(gesture, props) : previewMark(gesture, point, props);
  if (!mark) return;
  if ("index" in gesture) {
    const marks = props.marks.map((previous, index) => (index === gesture.index ? mark : previous));
    if (!areMarksEqual(marks, props.marks)) props.onMarksChange(marks);
    return;
  }
  if (props.marks.length >= MAX_ANNOTATION_MARKS) return;
  props.onMarksChange([...props.marks, mark]);
  setSelected(props.marks.length);
}

function pinchViewport(
  points: ImagePoint[],
  previous: ImagePoint[],
  viewport: AnnotationViewport,
): AnnotationViewport {
  const [first, second] = points;
  const [oldFirst, oldSecond] = previous;
  if (!first || !second || !oldFirst || !oldSecond) return viewport;
  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  const oldDistance = Math.hypot(oldSecond.x - oldFirst.x, oldSecond.y - oldFirst.y);
  if (oldDistance < 1) return viewport;
  const anchor = { x: (oldFirst.x + oldSecond.x) / 2, y: (oldFirst.y + oldSecond.y) / 2 };
  const zoomed = zoomViewport({
    viewport,
    anchor,
    scale: (viewport.scale * distance) / oldDistance,
  });
  return {
    ...zoomed,
    x: zoomed.x + (first.x + second.x) / 2 - anchor.x,
    y: zoomed.y + (first.y + second.y) / 2 - anchor.y,
  };
}

function hasPointerMoved(start: ImagePoint, screen: ImagePoint): boolean {
  return Math.hypot(screen.x - start.x, screen.y - start.y) >= CLICK_DISTANCE;
}

function moveGesture(options: PointerController, gesture: Gesture, screen: ImagePoint) {
  if (gesture.kind !== "pan") {
    return previewMark(gesture, screenToImage(screen, options.surface.viewport), options.props);
  }
  if (gesture.canDelete && !gesture.hasDragged && !hasPointerMoved(gesture.start, screen)) return;
  options.gesture.current = { ...gesture, hasDragged: true };
  options.setPanCursor("grabbing");
  options.surface.setViewport({
    ...gesture.viewport,
    x: gesture.viewport.x + screen.x - gesture.start.x,
    y: gesture.viewport.y + screen.y - gesture.start.y,
  });
  return undefined;
}

interface PointerController extends PointerOptions {
  gesture: RefObject<Gesture | undefined>;
  pointers: RefObject<Map<number, ImagePoint>>;
  setPreview: (mark: AnnotationMark | undefined) => void;
  setPanCursor: (cursor: "grab" | "grabbing" | undefined) => void;
}

function handlePointerDown(options: PointerController, event: PointerInput): void {
  const { gesture, pointers, setPreview, setPanCursor } = options;
  const isRightClick = event.button === 2 && event.pointerType === "mouse";
  if (event.button !== 0 && !isRightClick) return;
  event.preventDefault();
  event.currentTarget.focus();
  event.currentTarget.setPointerCapture(event.pointerId);
  const screen = pointerPosition(event, event.currentTarget);
  pointers.current.set(event.pointerId, screen);
  gesture.current =
    pointers.current.size !== 1
      ? undefined
      : isRightClick
        ? createPanGesture(options.surface, screen, true)
        : beginGesture(options, screen);
  setPanCursor(gesture.current?.kind === "pan" ? "grab" : undefined);
  setPreview(undefined);
}

function handlePointerMove(options: PointerController, event: PointerInput): void {
  const { gesture, pointers, setPreview } = options;
  if (!pointers.current.has(event.pointerId)) return;
  const previous = [...pointers.current.values()];
  const screen = pointerPosition(event, event.currentTarget);
  pointers.current.set(event.pointerId, screen);
  if (pointers.current.size === 2) {
    options.surface.setViewport((viewport) =>
      pinchViewport([...pointers.current.values()], previous, viewport),
    );
  } else if (gesture.current) setPreview(moveGesture(options, gesture.current, screen));
}

function handlePointerUp(options: PointerController, event: PointerInput): void {
  const { gesture, pointers, setPreview, setPanCursor } = options;
  if (!pointers.current.has(event.pointerId)) return;
  if (gesture.current)
    commitGesture(options, gesture.current, pointerPosition(event, event.currentTarget));
  pointers.current.delete(event.pointerId);
  gesture.current = undefined;
  setPreview(undefined);
  setPanCursor(undefined);
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId);
}

/** Transient pointer geometry never enters the audit payload or undo history. */
export function useAnnotationPointers(options: PointerOptions) {
  const gesture = useRef<Gesture | undefined>(undefined);
  const pointers = useRef(new Map<number, ImagePoint>());
  const [preview, setPreview] = useState<AnnotationMark>();
  const [panCursor, setPanCursor] = useState<"grab" | "grabbing">();
  const controller = { ...options, gesture, pointers, setPreview, setPanCursor };
  const onPointerCancel = () => {
    pointers.current.clear();
    gesture.current = undefined;
    setPreview(undefined);
    setPanCursor(undefined);
  };
  const previewIndex = gesture.current && "index" in gesture.current ? gesture.current.index : -1;
  return {
    onPointerDown: (event: PointerInput) => {
      handlePointerDown(controller, event);
    },
    onPointerMove: (event: PointerInput) => {
      handlePointerMove(controller, event);
    },
    onPointerUp: (event: PointerInput) => {
      handlePointerUp(controller, event);
    },
    onPointerCancel,
    preview,
    previewIndex,
    panCursor,
  };
}
