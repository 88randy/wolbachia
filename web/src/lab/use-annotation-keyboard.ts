import { useState, type KeyboardEvent } from "react";
import { clampMark, moveMark, type ImagePoint } from "./annotation-coordinates";
import type {
  AnnotationCanvasHandle,
  AnnotationCanvasProps,
  AnnotationTool,
} from "./annotation-canvas-types";
import { MAX_ANNOTATION_MARKS } from "./annotation-state";
import type { useAnnotationSurface } from "./use-annotation-surface";

type Surface = ReturnType<typeof useAnnotationSurface>;
interface KeyboardOptions {
  props: AnnotationCanvasProps;
  surface: Surface;
  view: AnnotationCanvasHandle;
  selected: number;
  setSelected: (index: number) => void;
}
const ARROW_DELTA: Record<string, ImagePoint> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};
const TOOL_KEYS: Record<string, AnnotationTool> = { v: "select", b: "box", d: "point", h: "pan" };
const PAN_STEP = 24;

function deleteSelection(options: KeyboardOptions): void {
  if (options.selected < 0 || !options.props.onMarksChange) return;
  options.props.onMarksChange(options.props.marks.filter((_, index) => index !== options.selected));
  options.setSelected(-1);
}

function cycleSelection(options: KeyboardOptions, offset: number): void {
  const count = options.props.marks.length;
  if (count === 0) return;
  const index = (options.selected + offset + count) % count;
  options.setSelected(index);
  const mark = options.props.marks[index];
  if (!mark) return;
  options.surface.setViewport((viewport) => ({
    ...viewport,
    x: options.surface.size.width / 2 - mark.x * viewport.scale,
    y: options.surface.size.height / 2 - mark.y * viewport.scale,
  }));
}

function editSelection(options: KeyboardOptions, delta: ImagePoint, isResize: boolean): boolean {
  const { props, selected } = options;
  const mark = props.marks[selected];
  if (!mark || props.tool !== "select" || !props.onMarksChange) return false;
  const edited =
    isResize && mark.kind === "box"
      ? clampMark({ ...mark, w: mark.w + delta.x, h: mark.h + delta.y }, props.image)
      : moveMark({ mark, delta, image: props.image });
  props.onMarksChange(
    props.marks.map((previous, index) => (index === selected ? edited : previous)),
  );
  return true;
}

function addAtCursor(options: KeyboardOptions, cursor: ImagePoint): void {
  const { props } = options;
  if (!props.onMarksChange || props.marks.length >= MAX_ANNOTATION_MARKS) return;
  if (props.tool !== "box" && props.tool !== "point") return;
  const mark =
    props.tool === "point"
      ? { kind: "point" as const, ...cursor }
      : {
          kind: "box" as const,
          x: cursor.x - props.defaultBox.width / 2,
          y: cursor.y - props.defaultBox.height / 2,
          w: props.defaultBox.width,
          h: props.defaultBox.height,
        };
  props.onMarksChange([...props.marks, clampMark(mark, props.image)]);
  options.setSelected(props.marks.length);
}

function toolShortcut(options: KeyboardOptions, key: string): boolean {
  const { props, view } = options;
  const tool = TOOL_KEYS[key];
  if (tool && props.onMarksChange) {
    props.onToolChange?.(tool);
    return true;
  }
  const commands: Record<string, (() => void) | undefined> = {
    "+": view.zoomIn,
    "=": view.zoomIn,
    "-": view.zoomOut,
    "0": view.fit,
    r: view.fit,
    "1": view.actualSize,
    g: props.onToggleGrid,
    s: props.onSettings,
    "?": props.onHelp,
  };
  const command = commands[key];
  command?.();
  return command !== undefined;
}

function invokeShortcut(options: KeyboardOptions, key: string): boolean {
  if (toolShortcut(options, key)) return true;
  const remove = () => {
    deleteSelection(options);
  };
  const previous = () => {
    cycleSelection(options, -1);
  };
  const next = () => {
    cycleSelection(options, 1);
  };
  const commands: Record<string, (() => void) | undefined> = {
    Delete: remove,
    Backspace: remove,
    "[": previous,
    "]": next,
    PageUp: previous,
    PageDown: next,
  };
  const command = commands[key];
  command?.();
  return command !== undefined;
}

interface KeyboardController extends KeyboardOptions {
  cursor: ImagePoint;
  setCursor: (cursor: ImagePoint) => void;
  setIsSpaceHeld: (held: boolean) => void;
}

function moveCursor(options: KeyboardController, event: KeyboardEvent, delta: ImagePoint): void {
  if (options.props.tool === "pan" || !options.props.onMarksChange) {
    options.surface.setViewport((viewport) => ({
      ...viewport,
      x: viewport.x - delta.x * PAN_STEP,
      y: viewport.y - delta.y * PAN_STEP,
    }));
  } else if (!editSelection(options, delta, event.shiftKey)) {
    const step = event.shiftKey ? 10 : 1;
    const mark = clampMark(
      { kind: "point", x: options.cursor.x + delta.x * step, y: options.cursor.y + delta.y * step },
      options.props.image,
    );
    options.setCursor({ x: mark.x, y: mark.y });
  }
}

function modifiedShortcut(options: KeyboardOptions, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== "z" || !options.props.onMarksChange) return false;
  if (event.shiftKey) options.props.onRedo?.();
  else options.props.onUndo?.();
  return true;
}

function editorShortcut(options: KeyboardController, event: KeyboardEvent): boolean {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === " ") {
    options.setIsSpaceHeld(true);
    return true;
  }
  if (key === "Enter") {
    addAtCursor(options, options.cursor);
    return true;
  }
  const delta = ARROW_DELTA[key];
  if (delta) {
    moveCursor(options, event, delta);
    return true;
  }
  return invokeShortcut(options, key);
}

function handleKeyDown(options: KeyboardController, event: KeyboardEvent): void {
  const isHandled =
    event.ctrlKey || event.metaKey
      ? modifiedShortcut(options, event)
      : editorShortcut(options, event);
  if (!isHandled) return;
  event.preventDefault();
  event.stopPropagation();
}

export function useAnnotationKeyboard(options: KeyboardOptions) {
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [cursor, setCursor] = useState<ImagePoint>({
    x: options.props.image.width / 2,
    y: options.props.image.height / 2,
  });
  const [isFocused, setIsFocused] = useState(false);
  const controller = { ...options, cursor, setCursor, setIsSpaceHeld };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key === " ") {
      event.preventDefault();
      setIsSpaceHeld(false);
    }
  };
  return {
    isSpaceHeld,
    onKeyDown: (event: KeyboardEvent) => {
      handleKeyDown(controller, event);
    },
    onKeyUp,
    cursor: isFocused ? cursor : undefined,
    onFocus: () => {
      setIsFocused(true);
    },
    onBlur: () => {
      setIsFocused(false);
      setIsSpaceHeld(false);
    },
  };
}
