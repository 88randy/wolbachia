import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { expect, test } from "vitest";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { setupI18n } from "../i18n/setup-i18n";
import { ME_QUERY_KEY } from "../session/me-query";
import { CATALOG, CATALOG_ADMIN, makeCatalogItem } from "../test/catalog-fixtures";
import { createFakeApi } from "../test/fake-api";
import { CatalogEditorContext } from "./catalog-editor-context";
import { CatalogAddButton } from "./CatalogAddButton";
import { CatalogAvailabilityButton } from "./CatalogAvailabilityButton";
import { useCatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";

function LimitedControls({ items }: { items: CatalogItem[] }) {
  const editor = useCatalogEditor(CATALOG.slug, items);
  return (
    <CatalogEditorContext value={editor}>
      <CatalogAddButton editor={editor} isReady />
      <CatalogAvailabilityButton item={makeCatalogItem({ is_active: false })} />
    </CatalogEditorContext>
  );
}

/** Exercise the real permission/state controls without paying to render 200 unrelated rows. */
async function renderLimitedControls() {
  const items = Array.from({ length: 200 }, (_, index) => makeCatalogItem({ id: String(index) }));
  const api = createFakeApi();
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });
  const queryClient = new QueryClient();
  queryClient.setQueryData(ME_QUERY_KEY, CATALOG_ADMIN);
  const instance = await setupI18n("es-MX");
  render(
    <I18nextProvider i18n={instance}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <LimitedControls items={items} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return api;
}

test("the active-item limit keeps permitted controls visible with a readable reason", async () => {
  const api = await renderLimitedControls();
  const user = userEvent.setup();
  for (const name of ["Agregar elemento", "Reactivar"]) {
    const control = screen.getByRole("button", { name });
    expect(control.getAttribute("aria-disabled")).toBe("true");
    const description = document.getElementById(control.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toContain("200 elementos activos");
    expect(description?.hidden).toBe(false);
    await user.click(control);
  }
  expect(api.requests).toHaveLength(0);
});
