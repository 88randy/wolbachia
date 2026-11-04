import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import type { FunctionComponent } from "react";
import { I18nextProvider } from "react-i18next";
import { ApiClientProvider } from "../api/ApiClientProvider";
import { createWebApiClient } from "../api/create-web-api-client";
import { createAppQueryClient } from "../api/query-client";
import { DataTable } from "../data-table/DataTable";
import type { DataTableProps } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import type { TableQueryConfig } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { setupI18n } from "../i18n/setup-i18n";
import { parseFlatSearch, stringifyFlatSearch } from "../router/flat-search";

/** A row of the tables under test. */
export interface Item {
  id: string;
  code: string;
  name: string;
  count: number;
  voided?: { reason: string; author: string };
}

export interface TableTestProps extends Omit<DataTableProps<Item>, "controller"> {
  config: TableQueryConfig;
  exportPath?: string;
}

/** A page of the app that shows the filter bar and the table over the URL, for one test. */
function TableScreen({ table }: { table: TableTestProps }) {
  const { config, exportPath, ...grid } = table;
  const controller = useTableUrlState(config);
  return (
    <>
      <FilterBar controller={controller} {...(exportPath === undefined ? {} : { exportPath })} />
      <DataTable {...grid} controller={controller} />
    </>
  );
}

/** The router of the app's flat query-string format with one route, in memory. */
function createTestRouter(screen: FunctionComponent, path: string) {
  const rootRoute = createRootRoute();
  const route = createRoute({ getParentRoute: () => rootRoute, path: "/", component: screen });
  return createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [path] }),
    parseSearch: parseFlatSearch,
    stringifySearch: stringifyFlatSearch,
  });
}

/** Props that change while the test runs, like the answer of a server. */
function createPropsStore(initial: TableTestProps) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => current,
    set: (next: TableTestProps) => {
      act(() => {
        current = next;
        listeners.forEach((listener) => {
          listener();
        });
      });
    },
  };
}

interface RenderTableOptions {
  path?: string;
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * Renders `FilterBar` + `DataTable` in a real router (memory history, the flat query-string
 * format of the app), so tests drive the URL like a user does. `setProps` changes what the
 * "server" answered, like a new page of results arriving.
 */
export async function renderTable(initial: TableTestProps, options: RenderTableOptions = {}) {
  const store = createPropsStore(initial);
  const Screen = () => <TableScreen table={useSyncExternalStore(store.subscribe, store.get)} />;
  const router = createTestRouter(Screen, options.path ?? "/");
  const fetchOption = options.fetch === undefined ? {} : { fetch: options.fetch };
  const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, fetchOption);
  const i18n = await setupI18n("es-MX");
  const queryClient = createAppQueryClient({ retry: false });
  await router.load();
  const result = render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <RouterProvider router={router} />
        </ApiClientProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return { ...result, router, queryClient, setProps: store.set };
}
