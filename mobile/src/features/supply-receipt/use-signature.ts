import { useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import { MAX_SIGNATURE_POINTS, MAX_SIGNATURE_STROKES, signaturePoint } from "./signature-path.ts";

interface Input {
  readonly strokes: readonly string[];
  readonly onChange: (strokes: readonly string[]) => void;
  readonly disabled: boolean;
}
/** Persist complete strokes; never advertise a raster as captured before file adoption. */
export function useSignature(input: Input) {
  const [path, setPath] = useState("");
  const dimensions = useRef({ width: 1, height: 1 });
  const points = useRef<string[]>([]);
  const add = (event: GestureResponderEvent) => {
    if (input.disabled || points.current.length >= MAX_SIGNATURE_POINTS) return;
    const { locationX: x, locationY: y } = event.nativeEvent;
    points.current.push(signaturePoint({ x, y, ...dimensions.current }));
    setPath(`M${points.current.join(" L")}`);
  };
  const finish = () => {
    if (points.current.length > 1 && input.strokes.length < MAX_SIGNATURE_STROKES)
      input.onChange([...input.strokes, `M${points.current.join(" L")}`]);
    points.current = [];
    setPath("");
  };
  return { path, dimensions, add, finish };
}
