import { useLayoutEffect, useRef } from "react";
import type { DragStartEvent, DragEndEvent, DragDropManager } from "@dnd-kit/react";
type ResetKey = string | number | undefined;
interface Origin {
  handle: HTMLElement;
  source: NonNullable<DragStartEvent["operation"]["source"]>;
  resetKey: ResetKey;
}
interface Pending {
  origin: Origin | null;
  frame: number | null;
  stopWatching: (() => void) | null;
}
function cancelPending(pending: Pending) {
  pending.origin = null;
  pending.stopWatching?.();
  pending.stopWatching = null;
  if (pending.frame !== null) cancelAnimationFrame(pending.frame);
  pending.frame = null;
}
function watchFocus(pending: Pending, origin: Origin) {
  const document = origin.handle.ownerDocument;
  const retire = (event: FocusEvent) => {
    const target = event.target;
    if (
      pending.origin === origin &&
      target instanceof Element &&
      target !== origin.handle &&
      target !== document.body &&
      target !== document.documentElement
    )
      cancelPending(pending);
  };
  pending.stopWatching = () => {
    document.removeEventListener("focusin", retire, true);
  };
  // Observe the choice before an application handler can remove the newly focused control.
  document.addEventListener("focusin", retire, true);
}
function begin(pending: Pending, event: DragStartEvent, resetKey: ResetKey) {
  cancelPending(pending);
  const source = event.operation.source;
  const handle = source?.handle;
  if (
    source &&
    event.operation.activatorEvent?.type === "keydown" &&
    handle instanceof HTMLElement
  ) {
    pending.origin = { handle, source, resetKey };
    watchFocus(pending, pending.origin);
  }
}
function restore({ handle, source }: Origin) {
  const document = handle.ownerDocument;
  if (
    source.handle === handle &&
    handle.isConnected &&
    !handle.closest("[inert]") &&
    document.activeElement === document.body
  )
    handle.focus({ preventScroll: true });
}
function afterCleanup(pending: Pending, origin: Origin, manager: DragDropManager) {
  pending.frame = requestAnimationFrame(() => {
    if (pending.origin !== origin) return;
    pending.frame = null;
    // dragend precedes the library's async renderer/DOM cleanup. Idle is the actual completion fence.
    if (!manager.dragOperation.status.idle) afterCleanup(pending, origin, manager);
    else {
      cancelPending(pending);
      restore(origin);
    }
  });
}
function end(
  pending: Pending,
  {
    event,
    resetKey,
    manager,
  }: { event: DragEndEvent; resetKey: ResetKey; manager: DragDropManager },
) {
  const origin = pending.origin;
  const source = event.operation.source;
  if (
    !origin ||
    origin.resetKey !== resetKey ||
    origin.source !== source ||
    origin.handle !== source.handle
  ) {
    cancelPending(pending);
    return;
  }
  afterCleanup(pending, origin, manager);
}
/** Instant drag cleanup can blur a moved row. Restore only its current keyboard origin, never a subsequent control/context. */
export function useReorderFocus(resetKey: ResetKey) {
  const pending = useRef<Pending>({ origin: null, frame: null, stopWatching: null });
  useLayoutEffect(
    () => () => {
      cancelPending(pending.current);
    },
    [resetKey],
  );
  return {
    start: (event: DragStartEvent) => {
      begin(pending.current, event, resetKey);
    },
    end: (event: DragEndEvent, manager: DragDropManager) => {
      end(pending.current, { event, resetKey, manager });
    },
  };
}
