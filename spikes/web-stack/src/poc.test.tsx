import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { axe } from "jest-axe";
import { makeRouter } from "./router";
import { setupI18n } from "./i18n";

async function renderAt(url: string) {
  await setupI18n("en");
  const router = makeRouter(createMemoryHistory({ initialEntries: [url] }));
  const utils = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, ...utils };
}

describe("web stack PoC", () => {
  it("renders a server-paged, filtered, sorted table from the URL and passes axe", async () => {
    const { container } = await renderAt("/incidents?status=open&page=2&ordering=code");
    // 57 rows, 38 open, page size 10 -> page 2 of 4, "code" ascending.
    expect(await screen.findByText("38 results, page 2 of 4")).toBeTruthy();
    const rows = within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");
    expect(rows).toHaveLength(10);
    expect(screen.getByRole("columnheader", { name: /code/i }).getAttribute("aria-sort")).toBe("ascending");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("writes filter, sort and page changes to the URL; invalid params fall back", async () => {
    const user = userEvent.setup();
    const { router } = await renderAt("/incidents?page=abc&ordering=bogus");
    expect(await screen.findByText("57 results, page 1 of 6")).toBeTruthy(); // fell back to defaults
    await user.selectOptions(screen.getByLabelText("Status"), "closed");
    await waitFor(() => expect(router.state.location.search).toMatchObject({ status: "closed", page: 1 }));
    await user.click(screen.getByRole("button", { name: "Code" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ ordering: "code" }));
    expect(await screen.findByText("19 results, page 1 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ page: 2 }));
  });

  it("shows the chart with its equivalent table and passes axe", async () => {
    const { container } = await renderAt("/dashboard");
    const table = await screen.findByRole("table", { name: "Weekly index" });
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("validates the count field with a translated error and keeps focus", async () => {
    const user = userEvent.setup();
    await renderAt("/count");
    const field = await screen.findByLabelText("Egg count");
    await user.type(field, "-3{Enter}");
    expect((await screen.findByRole("alert")).textContent).toBe("Enter an integer, 0 or more");
    expect(document.activeElement).toBe(field);
  });
});
