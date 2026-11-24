import { useEffect, useImperativeHandle } from "react";
import { fitViewport, zoomViewport } from "./annotation-coordinates";
import type { AnnotationCanvasHandle, AnnotationCanvasProps } from "./annotation-canvas-types";
import type { useAnnotationSurface } from "./use-annotation-surface";
import { pointerPosition } from "./use-annotation-pointers";

type Surface = ReturnType<typeof useAnnotationSurface>;
const ZOOM_STEP = 1.25;
const WHEEL_SENSITIVITY = 0.002;

export function useAnnotationView(
  props: AnnotationCanvasProps,
  surface: Surface,
): AnnotationCanvasHandle {
  const center = { x: surface.size.width / 2, y: surface.size.height / 2 };
  const zoom = (factor: number) => {
    surface.setViewport((viewport) =>
      zoomViewport({ viewport, anchor: center, scale: viewport.scale * factor }),
    );
  };
  const view: AnnotationCanvasHandle = {
    zoomIn: () => {
      zoom(ZOOM_STEP);
    },
    zoomOut: () => {
      zoom(1 / ZOOM_STEP);
    },
    fit: () => {
      surface.setViewport(fitViewport({ image: props.image, size: surface.size }));
    },
    actualSize: () => {
      surface.setViewport((viewport) => zoomViewport({ viewport, anchor: center, scale: 1 }));
    },
    focus: () => surface.canvasRef.current?.focus(),
  };
  useImperativeHandle(props.ref, () => view);
  useWheelZoom(surface);
  return view;
}

function useWheelZoom(surface: Surface): void {
  const { canvasRef, setViewport } = surface;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const anchor = pointerPosition(event, canvas);
      const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
      setViewport((viewport) =>
        zoomViewport({
          viewport,
          anchor,
          scale: viewport.scale * Math.exp(-delta * WHEEL_SENSITIVITY),
        }),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [canvasRef, setViewport]);
}
