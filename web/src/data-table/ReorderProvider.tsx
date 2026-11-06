import { ReorderReset } from "./ReorderReset";
import { DragDropProvider } from "@dnd-kit/react";
import { Feedback } from "@dnd-kit/dom";
import { isSortable } from "@dnd-kit/react/sortable";
import type { ReactNode } from "react";
import { useReorderAccessibility } from "./use-reorder-accessibility";
import { ReorderContext } from "./reorder-context";
import type { ReorderItem } from "./reorder-context";
import { useReorderFocus } from "./use-reorder-focus";
import type { DragEndEvent } from "@dnd-kit/react";
interface Props {
  items: readonly ReorderItem[];
  onMove: (from: string, to: string) => void;
  children: ReactNode;
  onStart?: () => void;
  onEnd?: () => void;
  resetKey?: string | number;
}
/** Pointer and keyboard use the same final-order transaction; Escape never publishes a move. */
export function ReorderProvider({ items, onMove, children, onStart, onEnd, resetKey }: Props) {
  const accessibility = useReorderAccessibility();
  const focus = useReorderFocus(resetKey);
  return (
    <ReorderContext value={items.some((item) => !item.isDisabled) ? items : null}>
      <DragDropProvider
        plugins={(defaults) => [
          ...defaults,
          accessibility,
          Feedback.configure({ dropAnimation: null, keyboardTransition: null }),
        ]}
        onDragStart={(event) => {
          focus.start(event);
          onStart?.();
        }}
        onDragEnd={(event, manager) => {
          focus.end(event, manager);
          onEnd?.();
          completeReorder(event, items, onMove);
        }}
      >
        <ReorderReset resetKey={resetKey} />
        {children}
      </DragDropProvider>
    </ReorderContext>
  );
}

function completeReorder(
  event: DragEndEvent,
  items: readonly ReorderItem[],
  onMove: Props["onMove"],
) {
  const source = event.operation.source;
  if (event.canceled || !isSortable(source)) return;
  const target = items.filter((item) => !item.isDisabled)[source.index];
  if (target && target.id !== String(source.id)) onMove(String(source.id), target.id);
}
