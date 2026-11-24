import { useState, type MouseEvent } from "react";
import { hitMark, screenToImage } from "./annotation-coordinates";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import { useAnnotationDrawing } from "./use-annotation-drawing";
import { useAnnotationKeyboard } from "./use-annotation-keyboard";
import { pointerPosition, useAnnotationPointers } from "./use-annotation-pointers";
import { useAnnotationSurface } from "./use-annotation-surface";
import { useAnnotationView } from "./use-annotation-view";

export function useAnnotationCanvas(props: AnnotationCanvasProps) {
  const [selected, setSelected] = useState(-1);
  const surface = useAnnotationSurface(props);
  const view = useAnnotationView(props, surface);
  const keyboard = useAnnotationKeyboard({ props, surface, view, selected, setSelected });
  const pointer = useAnnotationPointers({
    props,
    surface,
    selected,
    setSelected,
    isSpaceHeld: keyboard.isSpaceHeld,
  });
  useAnnotationDrawing({ props, surface, pointer, selected, cursor: keyboard.cursor });
  const onContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!props.onMarksChange || pointer.lastPointerType.current === "touch") return;
    const point = screenToImage(pointerPosition(event, event.currentTarget), surface.viewport);
    const index = hitMark(props.marks, point, 12 / surface.viewport.scale);
    if (index < 0) return;
    props.onMarksChange(props.marks.filter((_, markIndex) => markIndex !== index));
    setSelected(-1);
  };
  return { surface, keyboard, pointer, selected, onContextMenu };
}

export type AnnotationCanvasControl = ReturnType<typeof useAnnotationCanvas>;

export function annotationCanvasEvents(control: AnnotationCanvasControl) {
  return {
    onPointerDown: control.pointer.onPointerDown,
    onPointerMove: control.pointer.onPointerMove,
    onPointerUp: control.pointer.onPointerUp,
    onPointerCancel: control.pointer.onPointerCancel,
    onKeyDown: control.keyboard.onKeyDown,
    onKeyUp: control.keyboard.onKeyUp,
    onFocus: control.keyboard.onFocus,
    onBlur: control.keyboard.onBlur,
    onContextMenu: control.onContextMenu,
  };
}
