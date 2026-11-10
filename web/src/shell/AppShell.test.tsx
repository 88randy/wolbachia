import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AREAS } from "../router/areas";
import { STORAGE_KEYS } from "../storage/safe-storage";
import { makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";

beforeEach(() => {
  window.localStorage.clear();
});

describe("landmarks", () => {
  test("has banner, navigation, search and main, each once", async () => {
    await renderApp();

    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeDefined();
    expect(screen.getByRole("search", { name: "Buscar" })).toBeDefined();
  });

  test("the main landmark holds the single page heading", async () => {
    await renderApp({ path: "/fleet", me: makeMe({ permissions: ["motorcycle.read"] }) });

    const main = screen.getByRole("main");

    expect(within(main).getByRole("heading", { level: 1, name: "Flota" })).toBeDefined();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("sidebar navigation", () => {
  test("lists every area as a link inside lists", async () => {
    await renderApp({
      me: makeMe({
        permissions: [
          "catalog.read",
          "motorcycle.read",
          "quadrant.read",
          "supply_type.read",
          "incident.read",
          "notification.read",
          "egg_count.read",
          "review_item.read",
          "bag.receive",
        ],
      }),
    });
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });

    const links = within(nav).getAllByRole("link");

    expect(links).toHaveLength(14);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(AREAS.map((area) => area.path));
  });

  test("hides the areas the user may not open, but never Home", async () => {
    await renderApp({ me: makeMe({ permissions: [] }) });
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });

    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toContain("/");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).not.toContain("/fleet");
    expect(hrefs).not.toContain("/quadrants");
    expect(hrefs).not.toContain("/inventory");
    expect(hrefs).not.toContain("/incidents");
    expect(hrefs).not.toContain("/lab");
    expect(hrefs).not.toContain("/operations");
    expect(hrefs).toHaveLength(6);
  });

  test("groups the areas under headings", async () => {
    await renderApp();

    expect(screen.getByRole("list", { name: "Operación" })).toBeDefined();
    expect(screen.getByRole("list", { name: "Recursos" })).toBeDefined();
    expect(screen.getByRole("list", { name: "Análisis y administración" })).toBeDefined();
  });

  test("marks only the current page with aria-current", async () => {
    await renderApp({ path: "/operations", me: makeMe({ permissions: ["review_item.read"] }) });

    const current = screen.getAllByRole("link", { current: "page" });

    expect(current.map((link) => link.textContent)).toEqual(["Supervisión"]);
  });

  test("home is current only at the root, not on every page", async () => {
    await renderApp({ path: "/inventory", me: makeMe({ permissions: ["lot.read"] }) });

    expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBeNull();
  });

  test("navigating by keyboard changes the page", async () => {
    await renderApp({ me: makeMe({ permissions: ["bag.receive"] }) });

    screen.getByRole("link", { name: "Laboratorio" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { level: 1, name: "Laboratorio" })).toBeDefined();
  });
});

describe("keyboard", () => {
  test("the skip link is the first tab stop and moves focus to main", async () => {
    await renderApp();

    await userEvent.tab();
    const skipLink = screen.getByRole("link", { name: "Saltar al contenido" });
    expect(document.activeElement).toBe(skipLink);
    await userEvent.keyboard("{Enter}");

    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  test("footer and shell tools remain keyboard reachable after navigation", async () => {
    await renderApp({ me: makeMe({ permissions: ["catalog.read", "motorcycle.read"] }) });
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    within(nav).getAllByRole("link").at(-1)?.focus();
    const targets = [
      screen.getByRole("button", { name: "Colapsar menú" }),
      screen.getByRole("separator"),
      screen.getByRole("searchbox", { name: "Buscar" }),
      screen.getByRole("button", { name: "ES: cambiar idioma a inglés" }),
      screen.getByRole("switch", { name: "Tema oscuro" }),
      screen.getByRole("button", { name: /Menú de usuario/ }),
    ];
    for (const target of targets) {
      await userEvent.tab();
      expect(document.activeElement).toBe(target);
    }
  });

  test("Ctrl+K opens the command palette and focuses its input", async () => {
    await renderApp();

    await userEvent.keyboard("{Control>}k{/Control}");

    expect(document.activeElement).toBe(
      within(screen.getByRole("dialog")).getByRole("combobox", { name: "Buscar" }),
    );
  });

  test("Cmd+K opens the command palette and focuses its input", async () => {
    await renderApp();

    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(document.activeElement).toBe(
      within(screen.getByRole("dialog")).getByRole("combobox", { name: "Buscar" }),
    );
  });

  test("single-character keys are not shortcuts (WCAG 2.1.4)", async () => {
    await renderApp();

    await userEvent.keyboard("/k");

    expect(document.activeElement).toBe(document.body);
  });

  test("the field shows the shortcut and exposes it with aria-keyshortcuts", async () => {
    await renderApp();

    const search = screen.getByRole("searchbox", { name: "Buscar" });

    expect(search.getAttribute("aria-keyshortcuts")).toBe("Control+K Meta+K");
    expect(screen.getByRole("search").textContent).toContain("Ctrl K");
  });
});

describe("focus on navigation", () => {
  test("does not steal focus on the first load", async () => {
    await renderApp({ path: "/fleet", me: makeMe({ permissions: ["motorcycle.read"] }) });

    expect(document.activeElement).toBe(document.body);
  });

  test("moves focus to main after following a sidebar link", async () => {
    await renderApp({ me: makeMe({ permissions: ["egg_count.read"] }) });

    await userEvent.click(screen.getByRole("link", { name: "Laboratorio" }));

    await screen.findByRole("heading", { level: 1, name: "Laboratorio" });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });
});

describe("collapse button", () => {
  test("starts expanded and exposes its state", async () => {
    await renderApp();

    const toggle = screen.getByRole("button", { name: "Colapsar menú" });

    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe("sidebar");
  });

  test("collapsing keeps every link named and remembers the choice", async () => {
    await renderApp({ me: makeMe({ permissions: ["review_item.read"] }) });

    await userEvent.click(screen.getByRole("button", { name: "Colapsar menú" }));

    const toggle = screen.getByRole("button", { name: "Colapsar menú" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "Supervisión" })).toBeDefined();
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe("true");
  });

  test("a stored collapsed state is restored", async () => {
    window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "true");

    await renderApp();

    expect(screen.getByRole("button", { name: "Colapsar menú" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("compact viewport", () => {
  function setCompact(matches: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("below the breakpoint the toggle is hidden and every link stays named", async () => {
    setCompact(true);

    await renderApp({ me: makeMe({ permissions: ["review_item.read"] }) });

    expect(screen.queryByRole("button", { name: "Colapsar menú" })).toBeNull();
    expect(screen.getByRole("link", { name: "Supervisión" })).toBeDefined();
  });

  test("above the breakpoint the toggle is there", async () => {
    setCompact(false);

    await renderApp();

    expect(screen.getByRole("button", { name: "Colapsar menú" })).toBeDefined();
  });
});

describe("compact viewport focus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each(["toggle", "separator"] as const)(
    "focus moves to main when the focused %s disappears",
    async (control) => {
      const listeners = new Set<() => void>();
      let matches = false;
      vi.stubGlobal("matchMedia", (query: string) => ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }));
      await renderApp();
      const focused =
        control === "separator"
          ? screen.getByRole("separator")
          : screen.getByRole("button", { name: "Colapsar menú" });
      focused.focus();

      matches = true;
      act(() => {
        listeners.forEach((listener) => {
          listener();
        });
      });

      expect(screen.queryByRole("button", { name: "Colapsar menú" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("main"));
    },
  );
});

describe("top bar", () => {
  test("switches language without reload and updates <html lang>", async () => {
    await renderApp({ me: makeMe({ permissions: ["review_item.read"] }) });

    await userEvent.click(screen.getByRole("button", { name: "ES: cambiar idioma a inglés" }));

    expect(screen.getByRole("link", { name: "Supervision" })).toBeDefined();
    expect(screen.getByRole("button", { name: "EN: change language to Spanish" })).toBeDefined();
    expect(document.documentElement.lang).toBe("en");
  });

  test("notifications are hidden without the inbox permission", async () => {
    await renderApp();
    expect(screen.queryByRole("button", { name: "Notificaciones" })).toBeNull();
  });
});

describe("accessibility", () => {
  test.each(["es-MX", "en"] as const)("shell has no axe violations in %s", async (language) => {
    const { container } = await renderApp({ language });

    expect(await axe(container)).toHaveNoViolations();
  });

  test("collapsed shell has no axe violations", async () => {
    window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "true");
    const { container } = await renderApp({ path: "/people" });

    expect(await axe(container)).toHaveNoViolations();
  });

  test("not-found page inside the shell has no axe violations", async () => {
    const { container } = await renderApp({ path: "/nope" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
