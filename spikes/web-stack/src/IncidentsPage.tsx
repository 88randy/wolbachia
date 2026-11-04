import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getMe, listIncidents, type Incident } from "./mockApi";
import { incidentsRoute } from "./router";

const PAGE_SIZE = 10;
// Stable references: Table v9 recomputes row models when these change identity.
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Incident>();
const emptyRows: Incident[] = [];

export function IncidentsPage() {
  const { t } = useTranslation();
  const search = incidentsRoute.useSearch();
  const navigate = useNavigate({ from: incidentsRoute.fullPath });

  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const list = useQuery({
    queryKey: ["incidents", search],
    queryFn: () => listIncidents({ ...search, page_size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const columns = helper.columns([
    helper.accessor("code", { header: t("incidents.col.code") }),
    helper.accessor("status", { header: t("incidents.col.status"), cell: (c) => t(`status.${c.getValue()}`) }),
    helper.accessor("created_at", { header: t("incidents.col.created_at"), cell: (c) => c.getValue().slice(0, 10) }),
  ]);
  const table = useTable({ features, columns, data: list.data?.results ?? emptyRows });

  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE_SIZE));
  const sortable = ["code", "created_at"] as const;
  const sortOf = (id: string): "ascending" | "descending" | "none" =>
    search.ordering === id ? "ascending" : search.ordering === `-${id}` ? "descending" : "none";

  if (!me.data?.permissions.includes("incidents.view")) return null;

  return (
    <main>
      <h1>{t("incidents.title")}</h1>

      <label>
        {t("incidents.filter.status")}
        <select
          value={search.status ?? ""}
          onChange={(e) =>
            // Changing a filter resets to page 1 and pushes a history entry (back button restores state).
            navigate({ search: (s) => ({ ...s, status: (e.target.value || undefined) as Incident["status"] | undefined, page: 1 }) })
          }
        >
          <option value="">{t("incidents.filter.all")}</option>
          <option value="open">{t("status.open")}</option>
          <option value="closed">{t("status.closed")}</option>
        </select>
      </label>
      {search.status && (
        <button type="button" onClick={() => navigate({ search: (s) => ({ ...s, status: undefined, page: 1 }) })}>
          {t("incidents.filter.clear")}
        </button>
      )}

      <p role="status">{t("incidents.results", { count: list.data?.count ?? 0, page: search.page, pages })}</p>

      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const id = header.column.id;
                const canSort = (sortable as readonly string[]).includes(id);
                return (
                  <th key={header.id} scope="col" aria-sort={canSort ? sortOf(id) : undefined}>
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate({ search: (s) => ({ ...s, ordering: sortOf(id) === "ascending" ? `-${id}` : id, page: 1 } as typeof s) })
                        }
                      >
                        <table.FlexRender header={header} />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <nav aria-label="pagination">
        <button type="button" disabled={search.page <= 1} onClick={() => navigate({ search: (s) => ({ ...s, page: s.page - 1 }) })}>
          {t("incidents.prev")}
        </button>
        <button type="button" disabled={search.page >= pages} onClick={() => navigate({ search: (s) => ({ ...s, page: s.page + 1 }) })}>
          {t("incidents.next")}
        </button>
      </nav>
    </main>
  );
}
