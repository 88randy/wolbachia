import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { startApp } from "./start-app";

let container: HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

describe("startApp", () => {
  test("shows a translated configuration error, not a blank page, without the API URL", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startApp(container, {});

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "La aplicación no está lista" })).toBeDefined();
    });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("VITE_API_BASE_URL"));
  });

  test("applies the stored dark theme before the first render", async () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");

    await startApp(container, { VITE_API_BASE_URL: "/api/v1" });

    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  test("renders the app when the API URL is valid", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await startApp(container, { VITE_API_BASE_URL: "/api/v1" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Inicio" })).toBeDefined();
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
