import { installTableGeometry } from "../test/table-geometry";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { DragDropManager, DragEndEvent, DragStartEvent } from "@dnd-kit/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { ReorderProvider } from "./ReorderProvider";
import { TableRowFrame } from "./TableRowFrame";
import { useReorderFocus } from "./use-reorder-focus";
const ITEMS = [
  { id: "a", label: "Alpha", isDisabled: false },
  { id: "fixed", label: "Fixed", isDisabled: true },
  { id: "b", label: "Beta", isDisabled: false },
];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function openReorder() {
  installTableGeometry();
  const move = vi.fn();
  await renderWithI18n(
    <ReorderProvider items={ITEMS} onMove={move}>
      <table>
        <tbody>
          {ITEMS.map((item) => (
            <TableRowFrame key={item.id} id={item.id}>
              <td>{item.label}</td>
            </TableRowFrame>
          ))}
        </tbody>
      </table>
    </ReorderProvider>,
  );
  return { move, user: userEvent.setup() };
}
test("keyboard drop maps active positions across fixed rows and Escape publishes no move", async () => {
  const { move, user } = await openReorder();
  const handle = screen.getByRole("button", { name: "Reordenar: Beta" });
  handle.focus();
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("true");
  });
  await user.keyboard("[ArrowUp][Escape]");
  expect(move).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(document.activeElement).toBe(handle);
  });
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(handle.getAttribute("aria-pressed")).toBe("true");
  });
  await user.keyboard("[ArrowUp]");
  await user.keyboard("[Space]");
  await waitFor(() => {
    expect(move).toHaveBeenCalledExactlyOnceWith("b", "a");
  });
});
test("pointer activates the visible handle and cancellation never publishes a reorder", async () => {
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      readonly pointerId = 1;
      readonly pointerType = "mouse";
      readonly isPrimary = true;
    },
  );
  const { move, user } = await openReorder();
  expect(screen.queryByRole("button", { name: "Reordenar: Fixed" })).toBeNull();
  const source = screen.getByRole("button", { name: "Reordenar: Alpha" });
  await user.pointer({ target: source, keys: "[MouseLeft>]", coords: { x: 20, y: 20 } });
  await waitFor(() => {
    expect(source.getAttribute("aria-pressed")).toBe("true");
  });
  await user.keyboard("[Escape]");
  await user.pointer({ keys: "[/MouseLeft]" });
  expect(move).not.toHaveBeenCalled();
});

test("a later focused control retires keyboard restoration even when it disappears before cleanup", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  const flushFrame = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    act(() => {
      callbacks.forEach((callback) => {
        callback(0);
      });
    });
  };
  const handle = document.createElement("button");
  const search = document.createElement("input");
  document.body.append(handle, search);
  const source = { handle } as unknown as NonNullable<DragStartEvent["operation"]["source"]>;
  const operation = { source, activatorEvent: new KeyboardEvent("keydown", { key: " " }) };
  let idle = false;
  // Only the operation/paint boundary is controlled; focusin and removal are real DOM behavior.
  const manager = {
    dragOperation: {
      status: {
        get idle() {
          return idle;
        },
      },
    },
  } as DragDropManager;
  const view = renderHook(() => useReorderFocus("same context"));
  try {
    handle.focus();
    act(() => {
      view.result.current.start({ operation } as unknown as DragStartEvent);
    });
    handle.blur();
    act(() => {
      view.result.current.end({ operation } as unknown as DragEndEvent, manager);
    });
    flushFrame();
    expect(document.activeElement).toBe(document.body);
    search.focus();
    search.remove();
    idle = true;
    flushFrame();
    expect(document.activeElement).toBe(document.body);
  } finally {
    view.unmount();
    handle.remove();
    search.remove();
  }
});
