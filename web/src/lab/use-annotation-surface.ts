import { useEffect, useRef, useState } from "react";
import { fitViewport, type AnnotationViewport, type ImageSize } from "./annotation-coordinates";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";

export function useAnnotationImage(source: string) {
  const [image, setImage] = useState<HTMLImageElement>();
  const [hasError, setHasError] = useState(false);
  useEffect(() => {
    setImage(undefined);
    setHasError(false);
    const nextImage = new Image();
    nextImage.onload = () => {
      setImage(nextImage);
    };
    nextImage.onerror = () => {
      setHasError(true);
    };
    nextImage.src = source;
    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [source]);
  return { image, hasError };
}

function recenterViewport(current: AnnotationViewport, previous: ImageSize, next: ImageSize) {
  return {
    ...current,
    x: current.x + (next.width - previous.width) / 2,
    y: current.y + (next.height - previous.height) / 2,
  };
}

function useSurfaceSize(image: AnnotationCanvasProps["image"]) {
  const { width, height, src } = image;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ImageSize>({ width: 1, height: 1 });
  const [viewport, setViewport] = useState<AnnotationViewport>({ scale: 1, x: 0, y: 0 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let previousSize: ImageSize | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextSize = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (nextSize.width < 1 || nextSize.height < 1) return;
      const priorSize = previousSize;
      setSize(nextSize);
      setViewport((current) =>
        priorSize
          ? recenterViewport(current, priorSize, nextSize)
          : fitViewport({ image: { width, height }, size: nextSize }),
      );
      previousSize = nextSize;
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [width, height, src]);
  return { containerRef, size, viewport, setViewport };
}

export function useAnnotationSurface(props: AnnotationCanvasProps) {
  const surface = useSurfaceSize(props.image);
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const image = useAnnotationImage(props.image.src);
  const { onZoomChange } = props;
  useEffect(() => {
    onZoomChange?.(surface.viewport.scale);
  }, [onZoomChange, surface.viewport.scale]);
  return { ...surface, ...image, backgroundRef, canvasRef };
}
