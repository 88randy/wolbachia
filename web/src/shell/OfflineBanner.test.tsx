import { act, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { renderApp } from "../test/render-app";

const OFFLINE_TEXT =
  "Sin conexión. Lo que ves puede no estar actualizado; se actualizará cuando vuelva la red.";

function setConnection(isOnline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(isOnline);
  act(() => {
    window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfflineBanner", () => {
  test("shows nothing while online", async () => {
    await renderApp();

    expect(screen.queryByText(OFFLINE_TEXT)).toBeNull();
  });

  test("appears in a live region when the browser goes offline", async () => {
    await renderApp();

    setConnection(false);

    expect(screen.getByRole("status").textContent).toBe(OFFLINE_TEXT);
  });

  test("disappears when the connection returns", async () => {
    await renderApp();
    setConnection(false);

    setConnection(true);

    expect(screen.queryByText(OFFLINE_TEXT)).toBeNull();
  });

  test("starts visible when the page loads offline, in English too", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    await renderApp({ language: "en" });

    expect(screen.getByRole("status").textContent).toContain("No connection.");
  });

  test("has no axe violations while offline", async () => {
    const { container } = await renderApp();
    setConnection(false);

    expect(await axe(container)).toHaveNoViolations();
  });
});
