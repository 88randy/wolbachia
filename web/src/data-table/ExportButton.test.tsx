import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi } from "../test/fake-api";
import { renderTable } from "../test/render-table";
import type { TableTestProps } from "../test/render-table";
import { ApiError } from "@wolbachia/api-client";
import { createWebApiClient } from "../api/create-web-api-client";
import { ME_QUERY_KEY } from "../session/me-query";
import {
  endSessionExpiry,
  isSessionExpired,
  subscribeToMembershipLost,
} from "../session/session-events";
import { makeMe } from "../test/fake-api";
import { fileNameOf, requestExport } from "./request-export";
import type { TableQueryConfig } from "./table-types";

const EXPORT = "GET /api/v1/lab/bags/export/";
const CONFIG: TableQueryConfig = {
  paging: "page",
  pageSize: 20,
  supportsVoided: true,
  sortableIds: ["code"],
  filters: [
    {
      kind: "select",
      key: "status",
      labelKey: "phones.filter.status",
      options: [{ value: "open", labelKey: "phones.status.active" }],
    },
  ],
};

function propsOf(): TableTestProps {
  return {
    config: CONFIG,
    caption: "Registros",
    columns: [{ id: "code", headerKey: "phones.column.person", cell: (item) => item.code }],
    getRowId: (item) => item.id,
    data: {
      rows: [{ id: "1", code: "B-4471", name: "Alfa", count: 1 }],
      paging: { mode: "page", page: 1, pageSize: 20, count: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    },
    exportPath: "/api/v1/lab/bags/export/",
  };
}

const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
const createObjectURL = vi.fn(() => "blob:test");
const revokeObjectURL = vi.fn();
let downloads: string[] = [];

beforeEach(() => {
  downloads = [];
  click.mockImplementation(function recordDownload(this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  vi.clearAllMocks();
});

function csvReply(): Response {
  return new Response("code\nB-4471\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="bags-2026-11-04.csv"',
    },
  });
}

describe("export button", () => {
  test("is only there when the screen gives an export path", async () => {
    const { data, config, caption, columns, getRowId } = propsOf();
    await renderTable({ data, config, caption, columns, getRowId });

    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });

  test("asks the backend for the list in view and saves the file under the name it suggests", async () => {
    const user = userEvent.setup();
    const api = createFakeApi({ [EXPORT]: () => csvReply() });
    await renderTable(propsOf(), {
      path: "/?status=open&ordering=code&include_voided=true&page=3",
      fetch: api.fetch,
    });

    await user.click(screen.getByRole("button", { name: "Exportar" }));

    expect(await screen.findByText("La exportación se descargó.")).toBeDefined();
    const request = api.requests[0];
    const url = new URL(request?.path ?? "", "http://x");
    expect(url.pathname).toBe("/api/v1/lab/bags/export/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "open",
      ordering: "code",
      include_voided: "true",
      format: "csv",
    });
    expect(downloads).toEqual(["bags-2026-11-04.csv"]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });

  test("says it is preparing while the backend works, and ignores a second press", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const api = createFakeApi({ [EXPORT]: () => pending });
    await renderTable(propsOf(), { fetch: api.fetch });

    await user.click(screen.getByRole("button", { name: "Exportar" }));
    expect(await screen.findByText("Preparando la exportación")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    release(csvReply());

    expect(await screen.findByText("La exportación se descargó.")).toBeDefined();
    expect(api.requests).toHaveLength(1);
  });

  test("a refusal is an alert with the translated reason and nothing is saved", async () => {
    const user = userEvent.setup();
    const api = createFakeApi({ [EXPORT]: () => apiError(403, "permission_denied") });
    await renderTable(propsOf(), { fetch: api.fetch });

    await user.click(screen.getByRole("button", { name: "Exportar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("No tienes permiso");
    });
    expect(downloads).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  test("a path that is not an export endpoint is refused before any request", async () => {
    const user = userEvent.setup();
    const api = createFakeApi();
    await renderTable(
      { ...propsOf(), exportPath: "https://evil.example/export/" },
      { fetch: api.fetch },
    );

    await user.click(screen.getByRole("button", { name: "Exportar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });
    expect(api.requests).toHaveLength(0);
  });
});

describe("export failures and the session", () => {
  async function failWith(status: number, code: string) {
    const user = userEvent.setup();
    const api = createFakeApi({ [EXPORT]: () => apiError(status, code) });
    const app = await renderTable(propsOf(), { fetch: api.fetch });
    app.queryClient.setQueryData(ME_QUERY_KEY, makeMe());
    await user.click(screen.getByRole("button", { name: "Exportar" }));
    await screen.findByRole("alert");
  }

  test("the JSON error body survives the blob parsing: requestExport throws its code", async () => {
    const api = createFakeApi({ [EXPORT]: () => apiError(403, "no_active_membership") });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });

    const failure = await requestExport(client, "/api/v1/lab/bags/export/", {}).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe("no_active_membership");
    expect((failure as ApiError).status).toBe(403);
  });

  test("a body that is not JSON (a proxy page) still fails, with the generic code", async () => {
    const api = createFakeApi({
      [EXPORT]: () => new Response("<html>bad gateway</html>", { status: 502 }),
    });
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });

    const failure = await requestExport(client, "/api/v1/lab/bags/export/", {}).catch(
      (error: unknown) => error,
    );

    expect((failure as ApiError).status).toBe(502);
    expect((failure as ApiError).code).toBe("unknown_error");
  });

  test("a 401 opens the re-authentication flow like any other request", async () => {
    await failWith(401, "session_revoked");

    expect(isSessionExpired()).toBe(true);
    endSessionExpiry();
  });

  test("a lost membership is reported to the session", async () => {
    const lost = vi.fn();
    const unsubscribe = subscribeToMembershipLost(lost);

    await failWith(403, "no_active_membership");

    expect(lost).toHaveBeenCalledOnce();
    unsubscribe();
  });

  test("a plain refusal does not touch the session", async () => {
    await failWith(403, "permission_denied");

    expect(isSessionExpired()).toBe(false);
  });
});

describe("fileNameOf", () => {
  test.each([
    ['attachment; filename="a.csv"', "a.csv"],
    ["attachment; filename=a.csv", "a.csv"],
    ["attachment; filename*=UTF-8''Bolsas%202026.csv", "Bolsas 2026.csv"],
    ['attachment; filename="../../etc/passwd"', "passwd"],
    ['attachment; filename="..\\\\windows\\\\x.csv"', "x.csv"],
    ['attachment; filename=".hidden"', "export.csv"],
    ["attachment", "export.csv"],
    [null, "export.csv"],
  ])("%s gives %s", (header, expected) => {
    expect(fileNameOf(header)).toBe(expected);
  });
});
