import { useEffect, useRef } from "react";
import { useDragDropManager } from "@dnd-kit/react";
/** Cancel through the library so its optimistic DOM order is restored when the owning intent changes. */
export function ReorderReset({ resetKey }: { resetKey: string | number | undefined }) {
  const manager = useDragDropManager();
  const previous = useRef(resetKey);
  useEffect(() => {
    if (previous.current === resetKey) return;
    previous.current = resetKey;
    if (manager && !manager.dragOperation.status.idle) manager.actions.stop({ canceled: true });
  }, [manager, resetKey]);
  return null;
}
