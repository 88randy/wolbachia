import { act, screen, waitFor } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFakeApi, makeMe } from "../test/fake-api";
import { stubColorScheme } from "../test/color-scheme";
import { applyTheme } from "../theme/theme";
import { startApp } from "./start-app";

let container: HTMLElement;
let root: Root | undefined;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = undefined;
  applyTheme("light");
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("startApp", () => {
  test("shows a translated configuration error, not a blank page, without the API URL", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    root = await startApp(container, {});

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "La aplicación no está lista" })).toBeDefined();
    });
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("VITE_API_BASE_URL"));
  });

  test("resolves the default System preference before the first render", async () => {
    stubColorScheme(true);

    root = await startApp(container, { VITE_API_BASE_URL: "/api/v1" });

    expect(document.documentElement.dataset["theme"]).toBe("dark");
  });

  test("renders the app when the API URL is valid", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", createFakeApi({ "GET /api/v1/me/": Response.json(makeMe()) }).fetch);

    root = await startApp(container, { VITE_API_BASE_URL: "/api/v1" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Inicio" })).toBeDefined();
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
