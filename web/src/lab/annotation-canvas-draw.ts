import {
  boxCorners,
  type AnnotationViewport,
  type ImagePoint,
  type ImageSize,
} from "./annotation-coordinates";
import type { AnnotationMark } from "./annotation-state";

const GRID_CELLS = 8;
const MARK_LINE_WIDTH = 2;
const MARK_OUTLINE_WIDTH = 4;
const MARK_OUTLINE_COLOR = "var(--color-on-action)";
const POINT_RADIUS = 4;
const HANDLE_SIZE = 8;
const CSS_VARIABLE = /^var\((--[\w-]+)\)$/;

export function canvasColor(canvas: HTMLCanvasElement, color: string): string {
  const variable = CSS_VARIABLE.exec(color)?.[1];
  return variable ? getComputedStyle(canvas).getPropertyValue(variable).trim() : color;
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
  size: ImageSize,
): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(size.width * ratio);
  const height = Math.round(size.height * ratio);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  return context;
}

function transformCanvas(context: CanvasRenderingContext2D, viewport: AnnotationViewport): void {
  context.translate(viewport.x, viewport.y);
  context.scale(viewport.scale, viewport.scale);
}

export function drawImageLayer({
  canvas,
  size,
  viewport,
  image,
}: {
  canvas: HTMLCanvasElement;
  size: ImageSize;
  viewport: AnnotationViewport;
  image: HTMLImageElement;
}): void {
  const context = prepareCanvas(canvas, size);
  if (!context) return;
  transformCanvas(context, viewport);
  context.drawImage(image, 0, 0);
}

function traceMark(context: CanvasRenderingContext2D, mark: AnnotationMark, scale: number): void {
  if (mark.kind === "box") {
    context.rect(mark.x, mark.y, mark.w, mark.h);
    return;
  }
  const radius = POINT_RADIUS / scale;
  context.moveTo(mark.x + radius, mark.y);
  context.arc(mark.x, mark.y, radius, 0, Math.PI * 2);
}

function drawGrid(context: CanvasRenderingContext2D, image: ImageSize, scale: number): void {
  context.save();
  context.globalAlpha = 0.7;
  context.lineWidth = 1 / scale;
  context.setLineDash([6 / scale, 6 / scale]);
  context.beginPath();
  for (let index = 1; index < GRID_CELLS; index++) {
    const x = (image.width * index) / GRID_CELLS;
    const y = (image.height * index) / GRID_CELLS;
    context.moveTo(x, 0);
    context.lineTo(x, image.height);
    context.moveTo(0, y);
    context.lineTo(image.width, y);
  }
  context.stroke();
  context.restore();
}

function drawSelection(
  context: CanvasRenderingContext2D,
  mark: AnnotationMark,
  scale: number,
): void {
  context.save();
  context.setLineDash([4 / scale, 3 / scale]);
  context.beginPath();
  traceMark(context, mark, scale);
  const outline = canvasColor(context.canvas, MARK_OUTLINE_COLOR);
  strokeOutlinedPath(context, scale, outline);
  context.setLineDash([]);
  if (mark.kind === "box") {
    context.strokeStyle = outline;
    context.lineWidth = 1 / scale;
    const size = HANDLE_SIZE / scale;
    Object.values(boxCorners(mark)).forEach((corner) => {
      context.fillRect(corner.x - size / 2, corner.y - size / 2, size, size);
      context.strokeRect(corner.x - size / 2, corner.y - size / 2, size, size);
    });
  }
  context.restore();
}

function strokeOutlinedPath(
  context: CanvasRenderingContext2D,
  scale: number,
  outline: string,
): void {
  const color = context.strokeStyle;
  context.strokeStyle = outline;
  context.lineWidth = MARK_OUTLINE_WIDTH / scale;
  context.stroke();
  context.strokeStyle = color;
  context.lineWidth = MARK_LINE_WIDTH / scale;
  context.stroke();
}

function drawMarkPaths(context: CanvasRenderingContext2D, layer: MarksLayer): void {
  const scale = layer.viewport.scale;
  const outline = canvasColor(layer.canvas, MARK_OUTLINE_COLOR);
  for (const kind of ["box", "point"] as const) {
    context.beginPath();
    layer.marks.forEach((mark) => {
      if (mark.kind === kind) traceMark(context, mark, scale);
    });
    strokeOutlinedPath(context, scale, outline);
    if (kind === "point") context.fill();
  }
}

function drawCursor(context: CanvasRenderingContext2D, cursor: ImagePoint, scale: number): void {
  const radius = 8 / scale;
  context.beginPath();
  context.moveTo(cursor.x - radius, cursor.y);
  context.lineTo(cursor.x + radius, cursor.y);
  context.moveTo(cursor.x, cursor.y - radius);
  context.lineTo(cursor.x, cursor.y + radius);
  context.stroke();
}

export interface MarksLayer {
  canvas: HTMLCanvasElement;
  size: ImageSize;
  viewport: AnnotationViewport;
  image: ImageSize;
  marks: AnnotationMark[];
  selected: number;
  color: string;
  showGrid: boolean;
  cursor?: ImagePoint;
  preview?: AnnotationMark;
}

/** Batched geometry keeps thousands of eggs independent of the DOM node count. */
export function drawMarksLayer(layer: MarksLayer): void {
  const context = prepareCanvas(layer.canvas, layer.size);
  if (!context) return;
  transformCanvas(context, layer.viewport);
  context.strokeStyle = canvasColor(layer.canvas, layer.color);
  context.fillStyle = context.strokeStyle;
  context.lineWidth = MARK_LINE_WIDTH / layer.viewport.scale;
  if (layer.showGrid) drawGrid(context, layer.image, layer.viewport.scale);
  drawMarkPaths(context, layer);
  const selected = layer.marks[layer.selected];
  if (selected) drawSelection(context, selected, layer.viewport.scale);
  if (layer.preview) drawSelection(context, layer.preview, layer.viewport.scale);
  if (layer.cursor) drawCursor(context, layer.cursor, layer.viewport.scale);
}
