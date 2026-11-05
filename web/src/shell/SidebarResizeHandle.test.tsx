import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { setupI18n } from "../i18n/setup-i18n";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
import { web } from "@wolbachia/tokens";

test("splitter exposes its controlled sidebar and delegates keyboard sizing and collapse", async () => {
  const onWidth = vi.fn();
  const onToggle = vi.fn();
  const onReset = vi.fn();
  render(
    <I18nextProvider i18n={await setupI18n("en")}>
      <SidebarResizeHandle
        width={248}
        collapsed={false}
        onWidth={onWidth}
        onToggle={onToggle}
        onReset={onReset}
      />
    </I18nextProvider>,
  );
  const handle = screen.getByRole("separator");
  expect(handle.getAttribute("aria-controls")).toBe("sidebar");
  expect(handle.getAttribute("aria-valuenow")).toBe("248");
  expect(handle.getAttribute("aria-valuemin")).toBe(String(web.layout.sidebarMinWidth));
  fireEvent.keyDown(handle, { key: "ArrowRight" });
  expect(onWidth).toHaveBeenLastCalledWith(264);
  fireEvent.keyDown(handle, { key: "ArrowLeft" });
  expect(onWidth).toHaveBeenLastCalledWith(232);
  fireEvent.keyDown(handle, { key: "Home" });
  expect(onWidth).toHaveBeenLastCalledWith(web.layout.sidebarMinWidth);
  fireEvent.keyDown(handle, { key: "End" });
  expect(onWidth).toHaveBeenLastCalledWith(web.layout.sidebarMaxWidth);
  fireEvent.keyDown(handle, { key: "Enter" });
  expect(onToggle).toHaveBeenCalledOnce();
  fireEvent.doubleClick(handle);
  expect(onReset).toHaveBeenCalledOnce();
});

function dispatchPointer(
  handle: HTMLElement,
  type: string,
  position: { clientX: number; pointerId: number },
) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: position.clientX });
  Object.defineProperty(event, "pointerId", { value: position.pointerId });
  fireEvent(handle, event);
}

test("pointer capture resizes by the active drag only and cancellation ends it", async () => {
  const onWidth = vi.fn();
  render(
    <I18nextProvider i18n={await setupI18n("en")}>
      <SidebarResizeHandle
        width={248}
        collapsed={false}
        onWidth={onWidth}
        onToggle={vi.fn()}
        onReset={vi.fn()}
      />
    </I18nextProvider>,
  );
  const handle = screen.getByRole("separator");
  const capture = vi.fn();
  handle.setPointerCapture = capture;
  dispatchPointer(handle, "pointermove", { pointerId: 7, clientX: 250 });
  expect(onWidth).not.toHaveBeenCalled();
  dispatchPointer(handle, "pointerdown", { pointerId: 7, clientX: 200 });
  expect(capture).toHaveBeenCalledWith(7);
  dispatchPointer(handle, "pointermove", { pointerId: 8, clientX: 250 });
  expect(onWidth).not.toHaveBeenCalled();
  dispatchPointer(handle, "pointermove", { pointerId: 7, clientX: 250 });
  expect(onWidth).toHaveBeenLastCalledWith(298);
  dispatchPointer(handle, "pointermove", { pointerId: 7, clientX: 1000 });
  expect(onWidth).toHaveBeenLastCalledWith(web.layout.sidebarMaxWidth);
  dispatchPointer(handle, "pointercancel", { pointerId: 7, clientX: 1000 });
  dispatchPointer(handle, "pointermove", { pointerId: 7, clientX: 300 });
  expect(onWidth).toHaveBeenCalledTimes(2);
  expect(handle.dataset["dragging"]).toBe("false");
});
