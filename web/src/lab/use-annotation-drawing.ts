import { useEffect } from "react";
import { drawImageLayer, drawMarksLayer, type MarksLayer } from "./annotation-canvas-draw";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import type { ImagePoint } from "./annotation-coordinates";
import type { useAnnotationPointers } from "./use-annotation-pointers";
import type { useAnnotationSurface } from "./use-annotation-surface";

interface DrawingOptions {
  props: AnnotationCanvasProps;
  surface: ReturnType<typeof useAnnotationSurface>;
  pointer: ReturnType<typeof useAnnotationPointers>;
  selected: number;
  cursor?: ImagePoint;
}

function useBackgroundDrawing(surface: DrawingOptions["surface"]): void {
  const { backgroundRef, image, size, viewport } = surface;
  useEffect(() => {
    const canvas = backgroundRef.current;
    if (!canvas || !image) return;
    const frame = requestAnimationFrame(() => {
      drawImageLayer({ canvas, image, size, viewport });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [backgroundRef, image, size, viewport]);
}

function marksLayer(options: DrawingOptions, canvas: HTMLCanvasElement): MarksLayer {
  const { props, pointer, surface, selected, cursor } = options;
  const marks =
    pointer.preview && pointer.previewIndex >= 0
      ? props.marks.map((mark, index) =>
          index === pointer.previewIndex ? (pointer.preview ?? mark) : mark,
        )
      : props.marks;
  return {
    canvas,
    size: surface.size,
    viewport: surface.viewport,
    image: props.image,
    marks,
    selected,
    color: props.markerColor,
    showGrid: props.showGrid,
    cursor,
    preview: pointer.previewIndex < 0 ? pointer.preview : undefined,
  };
}

/** Separate image and marks layers avoid repainting the 4096px source during edits. */
export function useAnnotationDrawing(options: DrawingOptions): void {
  useBackgroundDrawing(options.surface);
  useEffect(() => {
    const canvas = options.surface.canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      drawMarksLayer(marksLayer(options, canvas));
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [options]);
}
