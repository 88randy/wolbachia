import { installTableGeometry } from "../test/table-geometry";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { renderWithI18n } from "../test/render-with-i18n";
import { ReorderProvider } from "./ReorderProvider";
import { TableRowFrame } from "./TableRowFrame";
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
  handle.focus();
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
