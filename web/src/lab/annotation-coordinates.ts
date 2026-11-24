import type { AnnotationMark } from "./annotation-state";

export interface ImagePoint {
  x: number;
  y: number;
}
export interface ImageSize {
  width: number;
  height: number;
}
export interface AnnotationViewport extends ImagePoint {
  scale: number;
}
export type BoxMark = Extract<AnnotationMark, { kind: "box" }>;
export type BoxCorner = "nw" | "ne" | "sw" | "se";
export const MIN_ANNOTATION_ZOOM = 0.02;
export const MAX_ANNOTATION_ZOOM = 16;

export function screenToImage(point: ImagePoint, viewport: AnnotationViewport): ImagePoint {
  return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale };
}

export function imageToScreen(point: ImagePoint, viewport: AnnotationViewport): ImagePoint {
  return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y };
}

export function fitViewport({
  image,
  size,
}: {
  image: ImageSize;
  size: ImageSize;
}): AnnotationViewport {
  const scale = Math.min(size.width / image.width, size.height / image.height);
  return {
    scale,
    x: (size.width - image.width * scale) / 2,
    y: (size.height - image.height * scale) / 2,
  };
}

export function zoomViewport({
  viewport,
  anchor,
  scale,
}: {
  viewport: AnnotationViewport;
  anchor: ImagePoint;
  scale: number;
}): AnnotationViewport {
  const pixel = screenToImage(anchor, viewport);
  const zoom = Math.max(MIN_ANNOTATION_ZOOM, Math.min(MAX_ANNOTATION_ZOOM, scale));
  return { scale: zoom, x: anchor.x - pixel.x * zoom, y: anchor.y - pixel.y * zoom };
}

function integerInside(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function isInsideImage(point: ImagePoint, image: ImageSize): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < image.width && point.y < image.height;
}

/** The editor clamps and rounds; the server independently rejects invalid coordinates. */
export function clampMark(mark: AnnotationMark, image: ImageSize): AnnotationMark {
  const x = integerInside(mark.x, image.width - 1);
  const y = integerInside(mark.y, image.height - 1);
  if (mark.kind === "point") return { kind: "point", x, y };
  return {
    kind: "box",
    x,
    y,
    w: Math.max(1, Math.min(image.width - x, Math.round(mark.w))),
    h: Math.max(1, Math.min(image.height - y, Math.round(mark.h))),
  };
}

export function createBox({
  start,
  end,
  image,
}: {
  start: ImagePoint;
  end: ImagePoint;
  image: ImageSize;
}): BoxMark {
  const left = integerInside(Math.min(start.x, end.x), image.width - 1);
  const top = integerInside(Math.min(start.y, end.y), image.height - 1);
  const right = integerInside(Math.max(start.x, end.x), image.width);
  const bottom = integerInside(Math.max(start.y, end.y), image.height);
  return {
    kind: "box",
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
  };
}

export function moveMark({
  mark,
  delta,
  image,
}: {
  mark: AnnotationMark;
  delta: ImagePoint;
  image: ImageSize;
}): AnnotationMark {
  const width = mark.kind === "box" ? mark.w : 1;
  const height = mark.kind === "box" ? mark.h : 1;
  return {
    ...mark,
    x: integerInside(mark.x + delta.x, image.width - width),
    y: integerInside(mark.y + delta.y, image.height - height),
  };
}

export function boxCorners(box: BoxMark): Record<BoxCorner, ImagePoint> {
  return {
    nw: { x: box.x, y: box.y },
    ne: { x: box.x + box.w, y: box.y },
    sw: { x: box.x, y: box.y + box.h },
    se: { x: box.x + box.w, y: box.y + box.h },
  };
}

export function resizeBox({
  box,
  corner,
  point,
  image,
}: {
  box: BoxMark;
  corner: BoxCorner;
  point: ImagePoint;
  image: ImageSize;
}): BoxMark {
  const opposite: Record<BoxCorner, BoxCorner> = { nw: "se", ne: "sw", sw: "ne", se: "nw" };
  return createBox({ start: boxCorners(box)[opposite[corner]], end: point, image });
}

export function hitResizeCorner(
  box: BoxMark,
  point: ImagePoint,
  tolerance: number,
): BoxCorner | undefined {
  return (Object.entries(boxCorners(box)) as [BoxCorner, ImagePoint][]).find(
    ([, corner]) => Math.hypot(corner.x - point.x, corner.y - point.y) <= tolerance,
  )?.[0];
}

function containsMark(mark: AnnotationMark, point: ImagePoint, tolerance: number): boolean {
  if (mark.kind === "point") return Math.hypot(mark.x - point.x, mark.y - point.y) <= tolerance;
  return (
    point.x >= mark.x - tolerance &&
    point.x <= mark.x + mark.w + tolerance &&
    point.y >= mark.y - tolerance &&
    point.y <= mark.y + mark.h + tolerance
  );
}

export function hitMark(marks: AnnotationMark[], point: ImagePoint, tolerance: number): number {
  for (let index = marks.length - 1; index >= 0; index--) {
    const mark = marks[index];
    if (mark && containsMark(mark, point, tolerance)) return index;
  }
  return -1;
}
