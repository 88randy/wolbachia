import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { createFakeApi, makeMe } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { centerStorageKey } from "./center-selection";
const CENTERS = [
  { id: "c1", code: "C-01", name: "Primero" },
  { id: "c2", code: "C-02", name: "Segundo" },
];
const paged = (results: unknown[]) => ({
  results,
  count: results.length,
  next: null,
  previous: null,
});
const SCOPE = {
  centers: { mode: "selected" as const, ids: CENTERS.map((center) => center.id) },
  quadrants: { mode: "all" as const, ids: [] },
};
function viewer(id: string) {
  const me = makeMe({ permissions: ["center.read", "role.read"], scope: SCOPE });
  return { ...me, user: { ...me.user, id } };
}
const role = (label: string) => ({
  id: "role",
  slug: "custom",
  label_es: label,
  label_en: label,
  permissions: ["role.read"],
  scope: SCOPE,
  revision: 1,
  is_active: true,
});

test("changing center clears caches and URL chips; an obsolete answer cannot return or expand grants", async () => {
  const me = viewer("center-change");
  let release: (reply: Response) => void = () => {
    throw new Error("Missing barrier");
  };
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/centers/": () =>
      Response.json(paged([...CENTERS, { id: "foreign", code: "C-03", name: "Foreign" }])),
    "GET /api/v1/roles/": () => {
      calls += 1;
      return calls === 1 ? pending : Response.json(paged([role("Resultados actuales")]));
    },
  });
  const app = await renderApp({ path: "/settings/roles?search=obsolete&page=2", fetch: api.fetch });
  await screen.findByRole("option", { name: "C-02 · Segundo" });
  const picker = screen.getByRole("combobox", { name: "Filtro de centro" });
  expect(
    within(picker).queryByRole("option", { name: "Todos los centros autorizados" }),
  ).toBeNull();
  expect(within(picker).queryByRole("option", { name: /Foreign/ })).toBeNull();
  await userEvent.selectOptions(picker, "c2");
  await screen.findByRole("cell", { name: "Resultados actuales" });
  await waitFor(() => {
    expect(app.router.state.location.search).toEqual({});
  });
  expect(window.localStorage.getItem(centerStorageKey(me))).toBe("c2");
  await act(async () => {
    release(Response.json(paged([role("Contenido obsoleto")])));
    await pending;
  });
  expect(screen.queryByText("Contenido obsoleto")).toBeNull();
  expect(
    api.requests.find((request) => request.path.includes("search=obsolete"))?.signal.aborted,
  ).toBe(true);
  expect(
    app.queryClient
      .getQueriesData({ predicate: (query) => query.queryKey[0] === "org" })
      .some(([, result]) => JSON.stringify(result).includes("Contenido obsoleto")),
  ).toBe(false);
});

test("a remembered id is validated across all pages and an inaccessible stored center is cleared", async () => {
  const me = viewer("center-restore");
  window.localStorage.setItem(centerStorageKey(me), "c2");
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/centers/": (request) =>
      Response.json(
        request.path.includes("page=2")
          ? paged([CENTERS[1]])
          : { ...paged([CENTERS[0]]), count: 2, next: "?page=2" },
      ),
  });
  const app = await renderApp({ fetch: api.fetch });
  const picker = await screen.findByRole<HTMLSelectElement>("combobox", {
    name: "Filtro de centro",
  });
  await screen.findByRole("option", { name: "C-02 · Segundo" });
  expect(picker.value).toBe("c2");
  api.setRoute("GET /api/v1/centers/", () => Response.json(paged([CENTERS[0]])));
  await act(async () => {
    await app.queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[3] === "centers",
    });
  });
  await waitFor(() => {
    expect(picker.value).toBe("");
  });
  expect(window.localStorage.getItem(centerStorageKey(me))).toBeNull();
});
