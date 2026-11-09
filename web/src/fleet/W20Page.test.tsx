import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  pageOf,
  settleFleet,
} from "./fleet-test-helpers";

describe("W20 fleet list", () => {
  test("links human codes, shows actual audit fields and sends only supported server ordering", async () => {
    const { api } = await openFleet({
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
      "Centro (ID)",
      "Fecha de alta",
    ]);
    expect(
      screen
        .getAllByRole("columnheader")
        .filter((header) => within(header).queryByRole("button"))
        .map((header) => header.textContent),
    ).toEqual(["Código", "Placa", "Centro (ID)", "Fecha de alta"]);
    await userEvent.click(
      within(screen.getByRole("table")).getByRole("button", { name: "Código" }),
    );
    await waitFor(() => {
      expect(api.requests.some((request) => request.path.includes("ordering=-code"))).toBe(true);
    });
    expect(
      screen.getByText(/indicadores de kilometraje.*no están disponibles para toda la lista/i),
    ).toBeDefined();
  });
  test("owns server filters and paging in the URL and preserves them on a record link", async () => {
    const user = userEvent.setup();
    let release: (reply: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { api, app, reads } = await openFleet({
      path: `${LIST}?page=2`,
      routes: {
        [GET]: ({ path }) =>
          path.includes("is_blocked=true") && path.includes("include_voided=true")
            ? held.then((reply) => reply.clone())
            : pageOf(
                [motorcycle({ id: "00000000-0000-4000-8000-000000000002", code: "M-02" })],
                60,
              ),
      },
    });
    await screen.findByRole("link", { name: "M-02" });
    const readBoundary = reads.length;
    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "true");
    await user.click(screen.getByRole("switch", { name: "Incluir anulados" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({
        is_blocked: "true",
        include_voided: "true",
      });
    });
    await waitFor(() => {
      const finalRequest = api.requests.find((request) => {
        const url = new URL(request.path, "https://test.invalid");
        return (
          request.method === "GET" &&
          url.pathname === "/api/v1/motorcycles/" &&
          url.searchParams.get("is_blocked") === "true" &&
          url.searchParams.get("include_voided") === "true" &&
          url.searchParams.get("page") === "1"
        );
      });
      expect(finalRequest?.path).toContain("is_blocked=true");
      expect(finalRequest?.path).toContain("include_voided=true");
    });
    release(pageOf([motorcycle()], 60));
    await settleFleet(
      { api, app, reads },
      {
        since: readBoundary,
        kind: "list",
        params: { is_blocked: "true", include_voided: "true", page: "1" },
      },
    );
    const href = (await screen.findByRole("link", { name: "M-03" })).getAttribute("href");
    expect(href).toContain("is_blocked=true");
    expect(href).toContain("include_voided=true");
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
    await openFleet({ me: makeMe({ ...ALLOWED, permissions: ["motorcycle.read"] }) });
    await screen.findByRole("link", { name: "M-03" });
    expect(screen.queryByRole("button", { name: "Alta de moto" })).toBeNull();
  });
  test.each(["none", "selected"] as const)(
    "explicit %s empty center scope cannot authorize a fleet read",
    async (mode) => {
      const { api } = await openFleet({
        me: makeMe({
          ...ALLOWED,
          scope: {
            centers: { mode, ids: [] },
            quadrants: { mode: "all", ids: [] },
          },
        }),
      });
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
      expect(api.requests.some((request) => request.path.startsWith("/api/v1/motorcycles/"))).toBe(
        false,
      );
      expect(screen.queryByRole("button", { name: "Alta de moto" })).toBeNull();
    },
  );
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

test("fleet exact-code search and column sorting are URL-owned and sent to the server", async () => {
  const { api, app } = await openFleet();
  await screen.findByRole("link", { name: "M-03" });
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Código exacto" }), "M-03");
  await user.keyboard("[Enter]");
  await user.click(within(screen.getByRole("columnheader", { name: /Placa/ })).getByRole("button"));
  await waitFor(() => {
    expect(app.router.state.location.search).toMatchObject({ code: "M-03", ordering: "plate" });
  });
  await waitFor(() => {
    expect(
      api.requests.some(
        ({ path }) => path.includes("code=M-03") && path.includes("ordering=plate"),
      ),
    ).toBe(true);
  });
  expect(screen.getByRole("columnheader", { name: /Placa/ }).getAttribute("aria-sort")).toBe(
    "ascending",
  );
});
