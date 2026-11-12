import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { messages } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { expect, test, vi } from "vitest";
import { apiError } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { fakePassword } from "../../test/fake-credentials";
import { openInventory } from "../../test/inventory-api";
import { inventoryPage, INVENTORY_CENTER } from "../../test/inventory-fixtures";
import {
  transfer,
  transferLine,
  transferEvent,
  transferMe,
  TRANSFER_ID,
  TRANSFER_SIGNATURE_ID,
} from "./transfer-fixtures";

// B04 byte/verification rules are owned by transfer-evidence.test.ts; this suite owns custody wiring.
// The drawn signature is replaced by one button that verifies it (the pad itself needs a canvas).
vi.mock("./TransferSignature", () => ({
  TransferSignature: ({
    onVerified,
    isBlocked,
  }: {
    onVerified: (id: string) => void;
    isBlocked?: boolean;
  }) => (
    <button
      type="button"
      disabled={isBlocked}
      onClick={() => {
        onVerified(TRANSFER_SIGNATURE_ID);
      }}
    >
      Firmar
    </button>
  ),
}));
const es = messages["es-MX"];
function receptionRoutes(current: () => Schemas["Transfer"]): FakeApiRoutes {
  return {
    "GET /api/v1/transfers/": () => Response.json(inventoryPage([current()])),
    [`GET /api/v1/transfers/${TRANSFER_ID}/`]: () => Response.json(current()),
  };
}
/**
 * The scanner now sits in the collapsed "something arrived that was not on the list" block: every
 * listed line already starts as "arrived as expected". Opens it (once) and returns the scan box.
 */
async function openScanner() {
  const existing = screen.queryByRole("textbox", { name: es["transfers.scan.label"] });
  if (existing) return existing;
  await userEvent.click(
    await screen.findByRole("button", { name: es["transfers.receive.extras"] }),
  );
  return screen.findByRole("textbox", { name: es["transfers.scan.label"] });
}
async function scanAndSign(user: ReturnType<typeof userEvent.setup>) {
  const scanner = await openScanner();
  await user.type(scanner, transferLine().lot_id);
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: "Firmar" }));
}
function receiveRequests(api: { requests: { method: string; path: string; body: unknown }[] }) {
  return api.requests.filter(
    (request) => request.method === "POST" && request.path.endsWith("/receive/"),
  );
}

test("a lost receipt response retries its original command once explicitly, announces commitment and restores scan focus", async () => {
  const user = userEvent.setup();
  let current = transfer();
  let receipt: Schemas["TransferEvent"] | undefined;
  const { api } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: {
      ...receptionRoutes(() => current),
      [`POST /api/v1/transfers/${TRANSFER_ID}/receive/`]: (request) => {
        if (receipt) return Response.json(receipt);
        const command = request.body as Schemas["ReceiveTransferRequest"];
        receipt = transferEvent({
          id: "15200000-0000-4000-8000-000000000011",
          kind: "receive",
          revision: 3,
          command_id: command.command_id,
        });
        current = {
          ...current,
          state: "received",
          revision: 3,
          events: [...current.events, receipt],
        };
        throw new TypeError("Synthetic lost committed receipt response");
      },
    },
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  await scanAndSign(user);
  await user.click(screen.getByRole("button", { name: es["transfers.action.receive"] }));
  await screen.findByText(es["transfers.write.retained"]);
  expect(receiveRequests(api)).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: es["common.actions.retry"] }));
  await screen.findByText(es["transfers.write.committed"].replace("{revision}", "3"));
  expect(receiveRequests(api)).toHaveLength(2);
  expect(receiveRequests(api)[1]?.body).toEqual(receiveRequests(api)[0]?.body);
  expect(receiveRequests(api)[0]?.body).toMatchObject({
    expected_revision: 2,
    signature_upload_id: TRANSFER_SIGNATURE_ID,
    missing: [],
  });
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: es["transfers.scan.label"] }),
    );
  });
});

test("reauthentication preserves captured receipt input and requires an explicit retry rather than replaying the write", async () => {
  const user = userEvent.setup();
  const { api, app } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: {
      ...receptionRoutes(() => transfer()),
      [`POST /api/v1/transfers/${TRANSFER_ID}/receive/`]: () => apiError(401, "not_authenticated"),
      "POST /api/v1/auth/login/": () =>
        Response.json({ me: transferMe(), server_time: "2026-11-06T12:00:00Z" }),
    },
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  await scanAndSign(user);
  await user.click(screen.getByRole("button", { name: es["transfers.action.receive"] }));
  await user.type(await screen.findByLabelText("Contraseña"), fakePassword());
  await user.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => {
    expect(screen.queryByLabelText("Contraseña")).toBeNull();
  });
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByRole("button", { name: es["transfers.write.retry"] });
  expect(
    screen.getByText(
      es["transfers.line.count"].replace("{expected}", "1").replace("{received}", "1"),
    ),
  ).toBeDefined();
  expect(receiveRequests(api)).toHaveLength(1);
});

test("a stock conflict refreshes current transfer facts and retains the signature until explicit review and resubmission", async () => {
  const user = userEvent.setup();
  const record = transfer({
    state: "prepared",
    revision: 1,
    events: [transferEvent({ kind: "prepared", revision: 1 })],
  });
  let attempts = 0;
  const { api } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: {
      ...receptionRoutes(() => record),
      [`POST /api/v1/transfers/${TRANSFER_ID}/dispatch/`]: (request) => {
        attempts += 1;
        if (attempts === 1)
          return Response.json(
            {
              code: "inventory_state_conflict",
              detail: "Synthetic stock conflict.",
              blocked_by: [{ reason: "lot_expired", unblocked_by_role: "warehouse", link: "" }],
            },
            { status: 409 },
          );
        const command = request.body as Schemas["DispatchTransferRequest"];
        return Response.json(transferEvent({ command_id: command.command_id }));
      },
    },
  });
  await user.click(await screen.findByRole("button", { name: "Firmar" }));
  await user.click(screen.getByRole("button", { name: es["transfers.action.dispatch"] }));
  await screen.findByText(es["inventory.blocker.lotExpired"], { exact: false });
  await screen.findByRole("button", { name: es["transfers.write.review"] });
  await waitFor(() => {
    expect(
      api.requests.filter((request) => request.path === `/api/v1/transfers/${TRANSFER_ID}/`),
    ).toHaveLength(2);
  });
  expect(attempts).toBe(1);
  await user.click(screen.getByRole("button", { name: es["transfers.write.review"] }));
  await waitFor(() => {
    expect(
      screen
        .getByRole("button", { name: es["transfers.action.dispatch"] })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
  expect(attempts).toBe(1);
  await user.click(screen.getByRole("button", { name: es["transfers.action.dispatch"] }));
  await screen.findByText(es["transfers.write.committed"].replace("{revision}", "2"));
  const commands = api.requests
    .filter((request) => request.method === "POST" && request.path.endsWith("/dispatch/"))
    .map((request) => request.body as Schemas["DispatchTransferRequest"]);
  expect(commands[0]).toMatchObject({
    signature_upload_id: TRANSFER_SIGNATURE_ID,
    expected_revision: 1,
  });
  expect(commands[1]).toMatchObject({
    signature_upload_id: TRANSFER_SIGNATURE_ID,
    expected_revision: 1,
  });
  expect(commands[1]?.command_id).not.toBe(commands[0]?.command_id);
});

test.each(["unknown", "foreign"])(
  "%s transfer codes have the same opaque outcome without an identity detail request",
  async (kind) => {
    const { api } = await openInventory({
      path: "/inventory/transfers/T-INACCESSIBLE",
      me: transferMe(),
      routes: {
        "GET /api/v1/transfers/": () =>
          kind === "foreign" ? apiError(404, "not_found") : Response.json(inventoryPage([])),
      },
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    expect(
      api.requests.some((request) => /^\/api\/v1\/transfers\/[^/?]+\//.test(request.path)),
    ).toBe(false);
  },
);

test("center-only scope may read a transfer whose warehouse locations have no quadrant", async () => {
  const me = transferMe();
  await openInventory({
    path: "/inventory/transfers/T-152",
    me: {
      ...me,
      scope: {
        centers: { mode: "selected", ids: [INVENTORY_CENTER] },
        quadrants: { mode: "none", ids: [] },
      },
    },
    routes: receptionRoutes(() => transfer()),
  });
  await openScanner();
  expect(screen.queryByText(es["transfers.page.denied"])).toBeNull();
});

test("reopening a committed receipt shows saved quantities without a new empty reception draft", async () => {
  const current = transfer({
    state: "discrepancy",
    events: [
      transferEvent({
        kind: "receive",
        manifest: {
          evidence: [],
          received: { [transferLine().id]: "0.8" },
          missing: [{ line_id: transferLine().id, quantity: "0.2", evidence_ids: [] }],
        },
      }),
    ],
  });
  await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: receptionRoutes(() => current),
  });
  await screen.findByText("0.8");
  expect(screen.getByText("0.2")).toBeDefined();
  expect(screen.queryByRole("textbox", { name: es["transfers.scan.label"] })).toBeNull();
  expect(screen.queryByRole("button", { name: "Firmar" })).toBeNull();
});

test("an explicit none scope denies a deep link before requesting transfer content", async () => {
  const me = transferMe();
  const { api } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: {
      ...me,
      scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "all", ids: [] } },
    },
  });
  await screen.findByText(es["transfers.page.denied"]);
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/transfers/"))).toBe(false);
});

test("a changed scope clears current receipt content and ignores a late detail from the previous scope", async () => {
  let release: (response: Response) => void = () => undefined;
  const late = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let shouldHold = false;
  let hasStarted = false;
  const { api, app } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: {
      ...receptionRoutes(() => transfer()),
      [`GET /api/v1/transfers/${TRANSFER_ID}/`]: () => {
        if (!shouldHold) return Response.json(transfer());
        hasStarted = true;
        return late;
      },
    },
  });
  await openScanner();
  shouldHold = true;
  act(() => {
    void app.queryClient.invalidateQueries({
      predicate: (query) => query.queryKey.includes("transfers"),
    });
  });
  await waitFor(() => {
    expect(hasStarted).toBe(true);
  });
  const me = transferMe();
  api.setRoute("GET /api/v1/me/", () =>
    Response.json({
      ...me,
      scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByText(es["transfers.page.denied"]);
  expect(screen.queryByRole("textbox", { name: es["transfers.scan.label"] })).toBeNull();
  await act(async () => {
    release(Response.json(transfer({ code: "OBSOLETE-PRIVATE-TRANSFER" })));
    await late;
  });
  expect(screen.queryByText("OBSOLETE-PRIVATE-TRANSFER")).toBeNull();
  expect(screen.queryByRole("heading", { name: "T-152" })).toBeNull();
});

test.each(["scope", "activeCenter"] as const)(
  "a permitted %s change masks receipt input until its current detail restores it without replay",
  async (mode) => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    const fresh = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let shouldHold = false;
    let hasStarted = false;
    const { api, app } = await openInventory({
      path: "/inventory/transfers/T-152",
      me: transferMe(),
      routes: {
        ...receptionRoutes(() => transfer()),
        [`GET /api/v1/transfers/${TRANSFER_ID}/`]: () => {
          if (!shouldHold) return Response.json(transfer());
          hasStarted = true;
          return fresh;
        },
      },
    });
    await scanAndSign(user);
    shouldHold = true;
    if (mode === "scope") {
      api.setRoute("GET /api/v1/me/", () =>
        Response.json({
          ...transferMe(),
          scope: {
            centers: { mode: "selected", ids: [INVENTORY_CENTER] },
            quadrants: { mode: "all", ids: [] },
          },
        }),
      );
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
    } else {
      await act(async () => {
        await app.router.navigate({
          to: "/inventory/transfers/$code",
          params: { code: "T-152" },
          search: { center: INVENTORY_CENTER },
        });
      });
    }
    await waitFor(() => {
      expect(hasStarted).toBe(true);
    });
    expect(screen.queryByRole("textbox", { name: es["transfers.scan.label"] })).toBeNull();
    expect(screen.queryByRole("button", { name: "Firmar" })).toBeNull();
    await act(async () => {
      shouldHold = false;
      release(Response.json(transfer()));
      await fresh;
    });
    await screen.findByText(
      es["transfers.line.count"].replace("{expected}", "1").replace("{received}", "1"),
    );
    expect(
      screen.getByRole("button", { name: es["transfers.action.receive"] }).hasAttribute("disabled"),
    ).toBe(false);
    expect(receiveRequests(api)).toHaveLength(0);
  },
);

test.each(["deniedRead", "revokedAction"] as const)(
  "a fresh %s retires receipt input before later access is restored",
  async (mode) => {
    const user = userEvent.setup();
    let isDenied = false;
    const { api, app } = await openInventory({
      path: "/inventory/transfers/T-152",
      me: transferMe(),
      routes: {
        ...receptionRoutes(() => transfer()),
        [`GET /api/v1/transfers/${TRANSFER_ID}/`]: () =>
          isDenied ? apiError(404, "not_found") : Response.json(transfer()),
      },
    });
    await scanAndSign(user);
    isDenied = mode === "deniedRead";
    const retained = transferMe();
    api.setRoute("GET /api/v1/me/", () =>
      Response.json({
        ...retained,
        permissions:
          mode === "revokedAction"
            ? retained.permissions.filter((permission) => permission !== "transfer.receive")
            : retained.permissions,
        scope: {
          centers: { mode: "selected", ids: [INVENTORY_CENTER] },
          quadrants: { mode: "all", ids: [] },
        },
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    if (mode === "deniedRead")
      await screen.findByRole("heading", { name: "No encontramos esta página" });
    else
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: es["transfers.action.receive"] })).toBeNull();
      });
    isDenied = false;
    api.setRoute("GET /api/v1/me/", () => Response.json(transferMe()));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await openScanner();
    expect(
      screen.getByText(
        es["transfers.line.count"].replace("{expected}", "1").replace("{received}", "0"),
      ),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: es["transfers.action.receive"] }).hasAttribute("disabled"),
    ).toBe(true);
    expect(receiveRequests(api)).toHaveLength(0);
  },
);

test("revoking a frozen dispatch grant reveals permitted reception after the current committed dispatch is read", async () => {
  const user = userEvent.setup();
  let current = transfer({
    state: "prepared",
    revision: 1,
    events: [
      transferEvent({
        id: "15200000-0000-4000-8000-000000000013",
        kind: "prepared",
        revision: 1,
      }),
    ],
  });
  const { api, app } = await openInventory({
    path: "/inventory/transfers/T-152",
    me: transferMe(),
    routes: {
      ...receptionRoutes(() => current),
      [`POST /api/v1/transfers/${TRANSFER_ID}/dispatch/`]: () => {
        current = transfer({ events: [...current.events, transferEvent()] });
        throw new TypeError("Synthetic lost dispatch response");
      },
    },
  });
  await user.click(await screen.findByRole("button", { name: "Firmar" }));
  await user.click(screen.getByRole("button", { name: es["transfers.action.dispatch"] }));
  await screen.findByText(es["transfers.write.retained"]);
  const allowed = transferMe();
  api.setRoute("GET /api/v1/me/", () =>
    Response.json({
      ...allowed,
      permissions: allowed.permissions.filter((permission) => permission !== "transfer.dispatch"),
    }),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await openScanner();
  expect(screen.queryByRole("button", { name: "Firmar" })).toBeNull();
  expect(
    api.requests.filter(
      (request) => request.method === "POST" && request.path.endsWith("/dispatch/"),
    ),
  ).toHaveLength(1);
  expect(receiveRequests(api)).toHaveLength(0);
});
