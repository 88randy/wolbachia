import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import { GET, LIST, motorcycle, openFleet, pageOf } from "./fleet-test-helpers";

describe("W20 fleet list", () => {
  test("links human codes, shows blocked reasons and void history, without invented columns or sort", async () => {
    await openFleet({
      routes: {
        [GET]: pageOf([
          motorcycle(),
          motorcycle({
            id: "2",
            code: "M-04",
            is_blocked: false,
            blocked_reason: "",
            voided_at: "2026-10-02T15:00:00Z",
            void_reason: "Wrong registration",
          }),
        ]),
      },
    });
    expect((await screen.findByRole("link", { name: "M-03" })).getAttribute("href")).toBe(
      `${LIST}/M-03`,
    );
    expect(screen.getByText("Revisión con falla grave")).toBeDefined();
    expect(screen.getByText(/Wrong registration/)).toBeDefined();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Código",
      "Placa",
      "Estado",
    ]);
    expect(within(screen.getByRole("table")).queryByRole("button")).toBeNull();
    expect(
      screen.getByText(/filtro por centro.*kilometraje.*próximo servicio.*rendimiento/i),
    ).toBeDefined();
  });
  test("owns server filters and paging in the URL and preserves them on a record link", async () => {
    const user = userEvent.setup();
    const { api, app } = await openFleet({
      path: `${LIST}?page=2`,
      routes: { [GET]: pageOf([motorcycle()], 60) },
    });
    await screen.findByRole("link", { name: "M-03" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "true");
    await user.click(screen.getByRole("checkbox", { name: "Incluir anulados" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({
        is_blocked: "true",
        include_voided: "true",
      });
    });
    await waitFor(() => {
      expect(
        api.requests.some(
          ({ path }) => path.includes("is_blocked=true") && path.includes("include_voided=true"),
        ),
      ).toBe(true);
    });
    expect(screen.getByRole("link", { name: "M-03" }).getAttribute("href")).toContain(
      "is_blocked=true",
    );
    expect(
      api.requests.some(({ path }) => path.includes("page=2") && path.includes("page_size=25")),
    ).toBe(true);
  });
  test.each([LIST, `${LIST}/M-03`, "/fleet"])(
    "denies %s without read permission and makes no fleet request",
    async (path) => {
      const { api } = await openFleet({ path, me: makeMe({ permissions: ["motorcycle.manage"] }) });
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
      expect(
        api.requests.some(({ path: requested }) => requested.startsWith("/api/v1/motorcycles/")),
      ).toBe(false);
      expect(screen.queryByRole("link", { name: "Flota" })).toBeNull();
    },
  );
  test("hides Add without manage permission", async () => {
    await openFleet({ me: makeMe({ permissions: ["motorcycle.read"] }) });
    await screen.findByRole("link", { name: "M-03" });
    expect(screen.queryByRole("button", { name: "Alta de moto" })).toBeNull();
  });
  test("shows loading before an empty result", async () => {
    let release: (reply: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await openFleet({ routes: { [GET]: () => held } });
    await screen.findByText("Cargando resultados");
    release(pageOf([]));
    await screen.findByText("Aquí todavía no hay registros");
  });
  test("offers an explicit retry after a failed read", async () => {
    let attempts = 0;
    await openFleet({
      routes: { [GET]: () => (++attempts === 1 ? apiError(500, "server_error") : pageOf()) },
    });
    expect((await screen.findByRole("alert")).textContent).toContain("Algo falló de nuestro lado");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("link", { name: "M-03" });
  });
  test.each(["es-MX", "en"] as const)(
    "has live results and no axe violations in %s",
    async (language) => {
      const { app } = await openFleet({ language });
      await screen.findByRole("link", { name: "M-03" });
      expect(screen.getAllByRole("status").some((status) => status.textContent.includes("1"))).toBe(
        true,
      );
      expect(await axe(app.container)).toHaveNoViolations();
    },
  );
});
