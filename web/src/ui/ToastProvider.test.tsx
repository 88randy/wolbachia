import { act, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { setupI18n } from "../i18n/setup-i18n";
import { ToastProvider, useToast } from "./ToastProvider";
import { isBlockingError } from "./toast-context";
const undo = vi.fn();
function ToastHarness() {
  const { showToast } = useToast();
  return (
    <button
      onClick={() => {
        showToast({ message: "Filter removed", action: { label: "Undo", onAction: undo } });
      }}
    >
      Remove filter
    </button>
  );
}
async function renderToasts() {
  const i18n = await setupI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove filter" }));
}
beforeEach(() => {
  vi.useFakeTimers();
  undo.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});
test("a reversible action expires after five seconds without running Undo", async () => {
  await renderToasts();
  act(() => {
    vi.advanceTimersByTime(4999);
  });
  expect(screen.queryByText("Filter removed")).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.queryByText("Filter removed")).toBeNull();
  expect(undo).not.toHaveBeenCalled();
});
test("hover and keyboard focus pause the remaining Undo window", async () => {
  await renderToasts();
  const action = screen.getByRole("button", { name: "Undo" });
  const toast = action.parentElement;
  if (toast === null) throw new Error("Toast container missing");
  act(() => {
    vi.advanceTimersByTime(3000);
  });
  fireEvent.mouseEnter(toast);
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  fireEvent.focus(action);
  fireEvent.mouseLeave(toast);
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(screen.queryByText("Filter removed")).not.toBeNull();
  fireEvent.blur(action, { relatedTarget: document.body });
  act(() => {
    vi.advanceTimersByTime(1999);
  });
  expect(screen.queryByText("Filter removed")).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.queryByText("Filter removed")).toBeNull();
});
test("Undo runs its callback once and dismisses the toast", async () => {
  await renderToasts();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(undo).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Filter removed")).toBeNull();
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(undo).toHaveBeenCalledTimes(1);
});

function QueuedToastHarness() {
  const { showToast } = useToast();
  return (
    <button
      onClick={() => {
        for (const message of ["First Undo", "Second", "Third", "Fourth"]) {
          showToast({ message, action: { label: "Undo", onAction: undo } });
        }
      }}
    >
      Queue notices
    </button>
  );
}

test("a fourth notice queues without shortening the visible Undo window", async () => {
  const i18n = await setupI18n("en");
  render(
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <QueuedToastHarness />
      </ToastProvider>
    </I18nextProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Queue notices" }));
  expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(3);
  expect(screen.queryByText("Fourth")).toBeNull();
  act(() => {
    vi.advanceTimersByTime(4999);
  });
  expect(screen.queryByText("First Undo")).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.queryByText("First Undo")).toBeNull();
  expect(screen.queryByText("Fourth")).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(4999);
  });
  expect(screen.queryByText("Fourth")).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(screen.queryByText("Fourth")).toBeNull();
});

test("only blocking errors use interruptive announcements", () => {
  expect(isBlockingError({ message: "Unavailable", tone: "critical", isBlocking: true })).toBe(
    true,
  );
  expect(isBlockingError({ message: "Retry available", tone: "critical" })).toBe(false);
  expect(isBlockingError({ message: "Updated", tone: "success", isBlocking: true })).toBe(false);
});
