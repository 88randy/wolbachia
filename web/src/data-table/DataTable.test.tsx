import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test, vi } from "vitest";
import { renderTable } from "../test/render-table";
import type { Item, TableTestProps } from "../test/render-table";
import type { DataTableColumn, TableData, TableQueryConfig } from "./table-types";

// The headers and filter labels borrow existing catalog keys: the table is generic, so the
// texts under test are "Persona", "Teléfono", "Versión" and "Estado" whatever they mean here.
const COLUMNS: readonly DataTableColumn<Item>[] = [
  { id: "code", headerKey: "phones.column.person", cell: (item) => item.code },
  { id: "name", headerKey: "phones.column.phone", cell: (item) => item.name },
  {
    id: "count",
    headerKey: "phones.column.version",
    align: "end",
    cell: (item) => item.count,
    link: (item) => ({ to: "/settings/phones", search: { code: item.code } }),
  },
];

const CONFIG: TableQueryConfig = {
  paging: "page",
  pageSize: 20,
  supportsVoided: true,
  sortableIds: ["code", "count"],
  defaultOrdering: "-count",
  filters: [
    {
      kind: "select",
      key: "status",
      labelKey: "phones.filter.status",
      options: [
        { value: "open", labelKey: "phones.status.active" },
        { value: "closed", labelKey: "phones.status.revoked" },
      ],
    },
    { kind: "text", key: "q", labelKey: "phones.column.phone", maxLength: 20 },
  ],
};

const ITEMS: Item[] = [
  { id: "1", code: "B-4471", name: "Alfa", count: 12 },
  { id: "2", code: "B-4472", name: "Beta", count: 7 },
  {
    id: "3",
    code: "B-4473",
    name: "Gamma",
    count: 3,
    voided: { reason: "Captura duplicada", author: "Ana Pérez" },
  },
];

function dataOf(overrides: Partial<TableData<Item>> = {}): TableData<Item> {
  return {
    rows: ITEMS,
    paging: { mode: "page", page: 1, pageSize: 20, count: 3 },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function propsOf(overrides: Partial<TableTestProps> = {}): TableTestProps {
  return {
    config: CONFIG,
    caption: "Registros de prueba",
    columns: COLUMNS,
    getRowId: (item) => item.id,
    data: dataOf(),
    ...overrides,
  };
}

/** The filter controls live in the "Filtros" popover of the filter bar. */
async function openFilters(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
}
async function pickStatus(user: ReturnType<typeof userEvent.setup>, label: string) {
  await openFilters(user);
  await user.click(await screen.findByRole("combobox", { name: "Estado" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

const search = (app: { router: { state: { location: { search: unknown } } } }) =>
  app.router.state.location.search;

describe("table markup and accessibility", () => {
  test("is a real table with a caption, column headers and one row per record", async () => {
    await renderTable(propsOf());

    expect(screen.getByRole("table", { name: "Registros de prueba" })).toBeDefined();
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(screen.getByRole("cell", { name: "Alfa" })).toBeDefined();
  });

  test("has no axe violations, with the filter bar and the footer", async () => {
    const { container } = await renderTable(propsOf());

    expect(await axe(container)).toHaveNoViolations();
  });

  test("announces the result count in a status region", async () => {
    await renderTable(propsOf());

    const count = screen.getByText("1–3 de 3");

    expect(count.getAttribute("role")).toBe("status");
  });

  test("the range follows the page: page 2 of 53 results shows 21 to 40", async () => {
    await renderTable(
      propsOf({ data: dataOf({ paging: { mode: "page", page: 2, pageSize: 20, count: 53 } }) }),
      { path: "/?page=2" },
    );

    expect(screen.getByText("21–23 de 53")).toBeDefined();
    expect(screen.getByText("Página 2 de 3")).toBeDefined();
  });
});

describe("sorting", () => {
  test("a sortable header is a button and a plain one is not", async () => {
    await renderTable(propsOf());

    expect(screen.getByRole("button", { name: "Persona" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Teléfono" })).toBeNull();
    const plain = screen.getByRole("columnheader", { name: "Teléfono" });
    expect(plain.getAttribute("aria-sort")).toBeNull();
  });

  test("the default order is shown as the current sort without being in the URL", async () => {
    const app = await renderTable(propsOf());

    expect(screen.getByRole("columnheader", { name: "Versión" }).getAttribute("aria-sort")).toBe(
      "descending",
    );
    expect(search(app)).toEqual({});
  });

  test("clicks cycle ascending, descending and back to the default, in the URL and aria-sort", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf());
    const header = screen.getByRole("columnheader", { name: "Persona" });
    expect(header.getAttribute("aria-sort")).toBe("none");

    await user.click(screen.getByRole("button", { name: "Persona" }));
    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "code" });
    });
    expect(header.getAttribute("aria-sort")).toBe("ascending");

    await user.click(screen.getByRole("button", { name: "Persona" }));
    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "-code" });
    });
    expect(header.getAttribute("aria-sort")).toBe("descending");

    await user.click(screen.getByRole("button", { name: "Persona" }));
    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
    expect(header.getAttribute("aria-sort")).toBe("none");
  });

  test("the sort state is announced in words in a live region", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf());

    await user.click(screen.getByRole("button", { name: "Persona" }));

    expect(await screen.findByText("Ordenado por Persona, de menor a mayor")).toBeDefined();
  });

  test("works with the keyboard: Tab to the header, Enter and Space sort", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf());
    const button = screen.getByRole("button", { name: "Persona" });
    button.focus();

    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "code" });
    });
    await user.keyboard(" ");
    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "-code" });
    });
    expect(document.activeElement).toBe(button);
  });

  test("sorting starts again from the first page", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf(), { path: "/?page=3" });

    await user.click(screen.getByRole("button", { name: "Persona" }));

    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "code" });
    });
  });
});

describe("filters in the URL", () => {
  test("choosing an option writes it to the URL, adds a chip and resets the page", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf(), { path: "/?page=3" });

    await pickStatus(user, "Activo");

    await waitFor(() => {
      expect(search(app)).toEqual({ status: "open" });
    });
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Activo" })).toBeDefined();
  });

  test("a filter in the URL is shown in its control and as a chip on first load", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf(), { path: "/?status=closed&q=1e3" });

    await openFilters(user);
    expect((await screen.findByRole("combobox", { name: "Estado" })).textContent).toContain(
      "Revocado",
    );
    expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Teléfono" }).value).toBe("1e3");
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Revocado" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Quitar filtro Teléfono: 1e3" })).toBeDefined();
  });

  test("the search box applies by itself after a pause and writes what was typed", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf());

    await user.type(screen.getByRole("searchbox", { name: "Teléfono" }), "4471");

    await waitFor(() => {
      expect(search(app)).toEqual({ q: "4471" });
    });
  });

  test("removing a chip removes only that filter", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf(), { path: "/?status=open&q=abc&ordering=code" });

    await user.click(screen.getByRole("button", { name: "Quitar filtro Estado: Activo" }));

    await waitFor(() => {
      expect(search(app)).toEqual({ q: "abc", ordering: "code" });
    });
  });

  test("Clear filters removes every filter and keeps the order", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf(), { path: "/?status=open&q=abc&ordering=code" });

    // The search box has its own clear button with the same name; the chips' one shows its text.
    await user.click(screen.getByText("Limpiar filtros"));

    await waitFor(() => {
      expect(search(app)).toEqual({ ordering: "code" });
    });
    expect(screen.queryByRole("list", { name: "Filtros activos" })).toBeNull();
  });

  test("the back button restores the previous filter", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf());
    await pickStatus(user, "Activo");
    await waitFor(() => {
      expect(search(app)).toEqual({ status: "open" });
    });

    app.router.history.back();

    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
    expect(screen.queryByRole("button", { name: /Quitar filtro Estado/ })).toBeNull();
  });

  test("an unknown or invalid parameter is ignored, named in a notice and can be dropped", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf(), { path: "/?colour=red&status=banana&q=ok" });

    const notice = screen.getByText(/no se aplicaron: colour, status/);
    expect(notice).toBeDefined();
    expect(screen.queryByRole("button", { name: /Quitar filtro Estado/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar filtro Teléfono: ok" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Quitar de la dirección" }));

    await waitFor(() => {
      expect(search(app)).toEqual({ q: "ok" });
    });
    expect(screen.queryByText(/no se aplicaron/)).toBeNull();
  });
});

describe("ignored parameters from a crafted link", () => {
  test("long names are cut and only a few are listed, with how many more", async () => {
    const long = "a".repeat(200);
    const many = Array.from(
      { length: 12 },
      (_unused, index) => `p${String(index).padStart(2, "0")}=1`,
    );
    await renderTable(propsOf(), { path: `/?${long}=1&${many.join("&")}` });

    const notice = screen.getByText(/no se aplicaron/);

    expect(notice.textContent).toContain(`${"a".repeat(32)}…`);
    expect(notice.textContent).not.toContain("a".repeat(33));
    expect(notice.textContent).toContain("y 8 más");
    expect(notice.textContent).not.toContain("p11");
  });
});

describe("voided records", () => {
  test("the toggle writes include_voided to the URL and back", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf());

    await openFilters(user);
    await user.click(await screen.findByRole("switch", { name: "Incluir anulados" }));
    await waitFor(() => {
      expect(search(app)).toEqual({ include_voided: "true" });
    });
    expect(
      screen.getByRole("switch", { name: "Incluir anulados" }).getAttribute("aria-checked") ??
        String(screen.getByRole<HTMLInputElement>("switch", { name: "Incluir anulados" }).checked),
    ).toBe("true");

    await user.click(screen.getByRole("switch", { name: "Incluir anulados" }));
    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
  });

  test("there is no toggle when the endpoint has no voided records", async () => {
    await renderTable(propsOf({ config: { ...CONFIG, supportsVoided: false } }));

    expect(screen.queryByRole("switch", { name: "Incluir anulados" })).toBeNull();
  });

  test("a voided row is struck through and shows badge, reason and author", async () => {
    await renderTable(propsOf({ voidOf: (item) => item.voided ?? null }));
    const row = screen.getByRole("row", { name: /B-4473/ });

    expect(within(row).getByText("Anulado")).toBeDefined();
    expect(within(row).getByText("Motivo: Captura duplicada")).toBeDefined();
    expect(within(row).getByText("Anuló: Ana Pérez")).toBeDefined();
    expect(within(row).getByText("B-4473").className).toContain("struck");
    const live = within(screen.getByRole("row", { name: /B-4471/ }));
    expect(live.queryByText("Anulado")).toBeNull();
    expect(live.getByText("B-4471").className).not.toContain("struck");
  });
});

describe("row selection", () => {
  const selection = {
    rowLabel: (item: Item) => item.code,
    renderActions: (rows: readonly Item[]) => (
      <button type="button">Acción sobre {rows.length}</button>
    ),
  };

  test("has no checkboxes unless the screen asks for selection", async () => {
    await renderTable(propsOf());

    expect(screen.queryAllByRole("checkbox", { name: /Seleccionar/ })).toHaveLength(0);
  });

  test("selecting a row names it, counts it in a status and shows the screen's actions", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf({ selection }));

    await user.click(screen.getByRole("checkbox", { name: "Seleccionar B-4472" }));

    expect(screen.getByText("Seleccionados: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: "Acción sobre 1" })).toBeDefined();
  });

  test("the header box selects every row of the page and is mixed in between", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf({ selection }));
    const all = screen.getByRole("checkbox", {
      name: "Seleccionar todas las filas de esta página",
    });

    await user.click(screen.getByRole("checkbox", { name: "Seleccionar B-4471" }));
    expect((all as HTMLInputElement).indeterminate).toBe(true);

    await user.click(all);
    expect(screen.getByText("Seleccionados: 3")).toBeDefined();
    expect((all as HTMLInputElement).checked).toBe(true);
  });

  test("works with the keyboard: Space toggles the focused checkbox", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf({ selection }));
    screen.getByRole("checkbox", { name: "Seleccionar B-4471" }).focus();

    await user.keyboard(" ");

    expect(screen.getByText("Seleccionados: 1")).toBeDefined();
  });

  test("Clear selection empties it", async () => {
    const user = userEvent.setup();
    await renderTable(propsOf({ selection }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar B-4471" }));

    await user.click(screen.getByRole("button", { name: "Quitar selección" }));

    expect(screen.queryByText(/Seleccionados:/)).toBeNull();
  });

  test("a new page of rows starts with nothing selected", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf({ selection }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar B-4471" }));

    app.setProps(propsOf({ selection, data: dataOf({ rows: [...ITEMS] }) }));

    expect(screen.queryByText(/Seleccionados:/)).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Seleccionar B-4471" }).checked,
    ).toBe(false);
  });

  test("a row the screen says cannot be selected has a disabled checkbox", async () => {
    await renderTable(
      propsOf({ selection: { ...selection, isSelectable: (item) => item.id !== "2" } }),
    );

    expect(
      screen.getByRole<HTMLInputElement>("checkbox", { name: "Seleccionar B-4472" }).disabled,
    ).toBe(true);
  });
});

describe("number cells and links", () => {
  test("a cell with a link is an anchor to the list behind it, right-aligned", async () => {
    await renderTable(propsOf());

    const link = screen.getByRole("link", { name: "12" });

    expect(link.getAttribute("href")).toBe("/settings/phones?code=B-4471");
    expect(link.closest("td")?.className).toContain("end");
    expect(screen.getByRole("columnheader", { name: /Versión/ }).className).toContain("end");
  });
});

describe("states", () => {
  test("first load shows a busy table and says it is loading", async () => {
    await renderTable(
      propsOf({
        data: dataOf({ rows: [], paging: undefined, isLoading: true, isFetching: true }),
      }),
    );

    expect(screen.getByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  test("a new page keeps the old rows in view while it loads", async () => {
    await renderTable(propsOf({ data: dataOf({ isFetching: true }) }));

    expect(screen.getByText("Cargando resultados")).toBeDefined();
    expect(screen.getByRole("cell", { name: "Alfa" })).toBeDefined();
    expect(screen.getByRole("progressbar")).toBeDefined();
  });

  test("no records and no filters says so", async () => {
    await renderTable(
      propsOf({
        data: dataOf({ rows: [], paging: { mode: "page", page: 1, pageSize: 20, count: 0 } }),
      }),
    );

    expect(screen.getByText("Aquí todavía no hay registros")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).toBeNull();
  });

  test("no results with filters offers to clear them, and it does", async () => {
    const user = userEvent.setup();
    const app = await renderTable(
      propsOf({
        data: dataOf({ rows: [], paging: { mode: "page", page: 1, pageSize: 20, count: 0 } }),
      }),
      { path: "/?status=open" },
    );

    expect(screen.getByText("Sin resultados con estos filtros")).toBeDefined();
    await user.click(
      within(
        screen.getByText("Sin resultados con estos filtros").parentElement as HTMLElement,
      ).getByRole("button", { name: "Limpiar filtros" }),
    );

    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
  });

  test("a failure shows a translated alert and Retry calls refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    await renderTable(
      propsOf({ data: dataOf({ rows: [], error: new TypeError("offline"), refetch }) }),
    );

    expect(screen.getByRole("alert").textContent).toContain("No hay conexión. Revisa tu señal e inténtalo de nuevo.");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  test("a page past the end fails with a way back to the first page", async () => {
    const user = userEvent.setup();
    const app = await renderTable(
      propsOf({ data: dataOf({ rows: [], paging: undefined, error: new TypeError("x") }) }),
      { path: "/?page=99" },
    );

    await user.click(screen.getByRole("button", { name: "Ir a la primera página" }));

    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
  });
});

describe("paging", () => {
  const PAGED = { mode: "page", page: 2, pageSize: 20, count: 53 } as const;

  test("Previous and Next move through the pages in the URL", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf({ data: dataOf({ paging: PAGED }) }), {
      path: "/?page=2",
    });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(search(app)).toEqual({ page: "3" });
    });
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
  });

  test("on the first page Previous does nothing and keeps keyboard focus", async () => {
    const user = userEvent.setup();
    const app = await renderTable(propsOf({ data: dataOf({ paging: { ...PAGED, page: 1 } }) }));
    const previous = screen.getByRole("button", { name: "Anterior" });
    previous.focus();

    await user.keyboard("{Enter}");

    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(search(app)).toEqual({});
    expect(document.activeElement).toBe(previous);
  });

  test("a single page has no pager", async () => {
    await renderTable(propsOf());

    expect(screen.queryByRole("navigation", { name: "Paginación" })).toBeNull();
  });

  test("cursor mode follows the cursor of the API links and goes back to the first page", async () => {
    const user = userEvent.setup();
    const cursorConfig = { ...CONFIG, paging: "cursor", supportsVoided: false } as const;
    const data = dataOf({
      paging: {
        mode: "cursor",
        next: "http://api.test/api/v1/things/?cursor=cD0yMDI2",
        previous: "http://api.test/api/v1/things/",
      },
    });
    const app = await renderTable(propsOf({ config: cursorConfig, data }), {
      path: "/?cursor=abc",
    });
    expect(screen.getByText("Resultados en esta página: 3")).toBeDefined();
    expect(screen.queryByText(/Página \d/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(search(app)).toEqual({ cursor: "cD0yMDI2" });
    });
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await waitFor(() => {
      expect(search(app)).toEqual({});
    });
  });
});

test("expanding a grouped row exposes its controlled detail and collapses it again", async () => {
  await renderTable(
    propsOf({
      groupOf: () => ({ id: "today", label: "Hoy" }),
      renderDetail: (item) => <p>{item.code} detalle</p>,
    }),
  );
  const button = screen.getAllByRole("button", { name: "Mostrar detalles" })[0];
  if (!button) throw new Error("Missing disclosure");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  await userEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  const detail = document.getElementById(button.getAttribute("aria-controls") ?? "");
  expect(detail?.textContent).toContain("B-4471 detalle");
  expect(screen.getAllByRole("rowheader", { name: "Hoy" })).toHaveLength(1);
  await userEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(detail?.hidden).toBe(true);
});

test("a failed background refresh retains rows and exposes retry inside the table", async () => {
  const refetch = vi.fn();
  await renderTable(
    propsOf({ data: dataOf({ error: new Error("synthetic refresh failure"), refetch }) }),
  );
  expect(screen.getByRole("table", { name: "Registros de prueba" })).toBeDefined();
  expect(screen.getByRole("cell", { name: "Alfa" })).toBeDefined();
  await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
  expect(refetch).toHaveBeenCalledOnce();
});
