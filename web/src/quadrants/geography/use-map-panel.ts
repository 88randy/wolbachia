import { appendMapVertex } from "./map-drawing";
import { useState } from "react";
export function useMapPanel(
  text: string | undefined,
  onText: ((text: string) => void) | undefined,
) {
  const [isOpen, setOpen] = useState(false);
  const [isDrawing, setDrawing] = useState(false);
  const onVertex = (location: number[]) => {
    if (isDrawing && onText) onText(appendMapVertex(text, location));
  };
  return {
    isOpen,
    isDrawing,
    setDrawing,
    onVertex,
    toggle: () => {
      setOpen(!isOpen);
    },
  };
}
