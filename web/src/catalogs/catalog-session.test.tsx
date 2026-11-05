import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { createFakeApi, makeOrganization } from "../test/fake-api";
import {
  CATALOG,
  CATALOG_ADMIN,
  CATALOG_PATH,
  ITEMS_PATH,
  makeCatalogItem,
} from "../test/catalog-fixtures";
import { renderApp } from "../test/render-app";
import { pageOf } from "../test/rules-fixtures";

function deferred() {
  let release!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test.each(["organization", "user"])(
  "a changed %s on the same catalog slug discards the ready draft and hides previous rows",
  async (change) => {
    const catalogs = deferred();
    const items = deferred();
    const api = createFakeApi({
      "GET /api/v1/me/": Response.json(CATALOG_ADMIN),
      "GET /api/v1/catalogs/": () => pageOf([CATALOG]),
      [`GET ${ITEMS_PATH}`]: () => pageOf([makeCatalogItem({ label_es: "Private A row" })]),
    });
    const app = await renderApp({ path: CATALOG_PATH, fetch: api.fetch });
    await screen.findByRole("row", { name: /Private A row/ });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
    await user.type(screen.getByLabelText("Código"), "private-draft");
    await user.type(screen.getByLabelText("Etiqueta en español (obligatoria)"), "Private draft");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Guardar" }).disabled).toBe(false);

    const next =
      change === "organization"
        ? { ...CATALOG_ADMIN, organization: makeOrganization("sur", "South") }
        : { ...CATALOG_ADMIN, user: { ...CATALOG_ADMIN.user, id: "another-user" } };
    api.setRoute("GET /api/v1/me/", Response.json(next));
    api.setRoute("GET /api/v1/catalogs/", () => catalogs.promise);
    api.setRoute(`GET ${ITEMS_PATH}`, () => items.promise);
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("row", { name: /Private A row/ })).toBeNull();
    });
    expect(app.router.state.location.pathname).toBe(CATALOG_PATH);
    expect(screen.queryByRole("link", { name: "Intervenciones" })).toBeNull();
    await act(async () => {
      catalogs.release(pageOf([{ ...CATALOG, label_es: "B catalog" }]));
      await catalogs.promise;
    });
    await screen.findByRole("link", { name: "B catalog" });
    expect(screen.queryByRole("row", { name: /Private A row/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      items.release(pageOf([makeCatalogItem({ label_es: "B row" })]));
      await items.promise;
    });
    await screen.findByRole("row", { name: /B row/ });
    await user.click(screen.getByRole("button", { name: "Agregar elemento" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText<HTMLInputElement>("Código").value).toBe("");
    expect(dialog.getByLabelText<HTMLInputElement>("Etiqueta en español (obligatoria)").value).toBe(
      "",
    );
    expect(
      api.requests.filter(({ method, path }) => method === "POST" && path === ITEMS_PATH),
    ).toHaveLength(0);
  },
);
