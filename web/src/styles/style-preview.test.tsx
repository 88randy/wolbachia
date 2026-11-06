import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { expect, test } from "vitest";
import { createPreviewRouter } from "../../harness/preview-router";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { setupI18n } from "../i18n/setup-i18n";
import { createFakeApi, makeMe } from "../test/fake-api";

test("preview uses the session-backed real shell and URL-controlled record sheet with Back", async () => {
  const fake = createFakeApi({ "GET /api/v1/me/": Response.json(makeMe()) });
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: fake.fetch });
  const queryClient = createAppQueryClient({ retry: false });
  const router = createPreviewRouter({ client, queryClient });
  const i18n = await setupI18n("es-MX");
  await router.load();
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <RouterProvider router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  expect(await screen.findByRole("heading", { name: "Operación de campo" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Componentes compartidos" })).toBeDefined();
  const table = screen.getByRole("table", { name: "Lecturas recientes" });
  const row = within(table).getByRole("row", { name: /OV-1284/ });
  await userEvent.click(within(row).getByRole("button", { name: "Abrir panel lateral" }));
  expect(await screen.findByRole("dialog", { name: "OV-1284" })).toBeDefined();
  expect(router.state.location.search).toMatchObject({ record: "OV-1284" });
  await act(async () => {
    router.history.back();
    await router.load();
  });
  expect(screen.queryByRole("dialog", { name: "OV-1284" })).toBeNull();
  expect(fake.requests.every((request) => request.path === "/api/v1/me/")).toBe(true);
});
