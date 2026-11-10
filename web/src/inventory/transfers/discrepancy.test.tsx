import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { openInventory, inventoryMe } from "../../test/inventory-api";
import { inventoryPage, INVENTORY_TIME } from "../../test/inventory-fixtures";

function caseFixture(): Schemas["Discrepancy"] {
  const transfer: Schemas["Transfer"] = {
    id: "00000000-0000-4000-8000-000000000151",
    code: "T-152",
    origin_id: "origin",
    destination_id: "destination",
    revision: 3,
    state: "discrepancy",
    lines: [],
    events: [],
    outstanding: {},
    created_at: INVENTORY_TIME,
    created_by: null,
  };
  return {
    id: "00000000-0000-4000-8000-000000000152",
    code: "D-152",
    transfer_id: transfer.id,
    transfer,
    receipt_event_id: "receipt",
    lines: [
      {
        id: "case-line",
        line_id: "expected-line",
        kind: "missing",
        quantity: "2",
        observation: {},
      },
    ],
    holds: [
      {
        id: "own-hold",
        lot_id: "held-lot",
        location_id: "destination",
        piece_id: null,
        resolution_id: null,
      },
    ],
    status: "open",
    revision: 0,
    resolution: null,
    created_by: null,
    created_at: INVENTORY_TIME,
  };
}
function resolutionFixture(record: Schemas["Discrepancy"]): Schemas["TransferEvent"] {
  return {
    id: "resolution",
    transfer_id: record.transfer_id,
    revision: 4,
    kind: "resolution",
    command_id: "server-command",
    manifest: { evidence: [], discrepancy_id: record.id },
    manifest_hash: "original-hash",
    device_time: INVENTORY_TIME,
    server_received_at: INVENTORY_TIME,
    declared_source_uuid: null,
    operation_id: null,
    discrepancy_id: record.id,
    created_by: null,
    created_at: INVENTORY_TIME,
  };
}
test("a lost close response freezes and retries the exact reviewed resolution without a client command UUID", async () => {
  const user = userEvent.setup();
  const record = caseFixture();
  let attempts = 0;
  const { api } = await openInventory({
    path: "/inventory/discrepancies/D-152",
    me: inventoryMe({ permissions: ["discrepancy.read", "discrepancy.close"] }),
    routes: {
      "GET /api/v1/discrepancies/": () => Response.json(inventoryPage([record])),
      [`GET /api/v1/discrepancies/${record.id}/`]: () => Response.json(record),
      [`POST /api/v1/discrepancies/${record.id}/close/`]: () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("Synthetic lost resolution response");
        return Response.json(resolutionFixture(record));
      },
    },
  });
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Cómo se resolvió esta línea" }),
    "ack_missing",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Motivo de la resolución" }),
    "Confirmed missing material",
  );
  await user.click(screen.getByRole("button", { name: "Revisar y cerrar discrepancia" }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => {
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }));
  });
  await user.click(within(dialog).getByRole("button", { name: "Confirmar resolución" }));
  await user.click(await screen.findByRole("button", { name: "Reintentar la misma resolución" }));
  await screen.findByText("Resolución registrada en el servidor");
  const writes = api.requests.filter((request) => request.method === "POST");
  expect(writes).toHaveLength(2);
  expect(writes[1]?.body).toEqual(writes[0]?.body);
  expect(writes[0]?.body).toMatchObject({
    expected_revision: 0,
    resolution: { outcomes: [{ line_id: "case-line", kind: "ack_missing", quantity: "2" }] },
  });
  expect(writes[0]?.body).not.toHaveProperty("command_id");
});

test("an explicit empty center scope denies a discrepancy deep link before reading case facts", async () => {
  const { api } = await openInventory({
    path: "/inventory/discrepancies/D-152",
    me: inventoryMe({
      permissions: ["discrepancy.read"],
      scope: { centers: { mode: "selected", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  await screen.findByText(
    "No tienes permiso o alcance para consultar discrepancias. Solicita acceso al administrador.",
  );
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/discrepancies/"))).toBe(
    false,
  );
});

test("a changed scope hides the draft behind a current-read barrier and restores permitted input without replay", async () => {
  const user = userEvent.setup();
  const record = caseFixture();
  let hasChangedScope = false;
  let hasWaitingRead = false;
  let release: (response: Response) => void = () => undefined;
  const currentRead = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const { api, app } = await openInventory({
    path: "/inventory/discrepancies/D-152",
    me: inventoryMe({
      permissions: ["discrepancy.read", "discrepancy.close", "transfer.receive", "field.upload"],
    }),
    routes: {
      "GET /api/v1/discrepancies/": () => {
        if (!hasChangedScope) return Response.json(inventoryPage([record]));
        hasWaitingRead = true;
        return currentRead;
      },
      [`GET /api/v1/discrepancies/${record.id}/`]: () => Response.json(record),
    },
  });
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Cómo se resolvió esta línea" }),
    "ack_missing",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Motivo de la resolución" }),
    "Permitted private resolution draft",
  );
  hasChangedScope = true;
  await act(async () => {
    await app.router.navigate({
      to: "/inventory/discrepancies/$code",
      params: { code: record.code },
      search: { center: "00000000-0000-4000-8000-000000000153" },
    });
  });
  await waitFor(() => {
    expect(hasWaitingRead).toBe(true);
  });
  expect(screen.queryByRole("textbox", { name: "Motivo de la resolución" })).toBeNull();
  await act(async () => {
    release(Response.json(inventoryPage([record])));
    await currentRead;
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Motivo de la resolución" }))
      .value,
  ).toBe("Permitted private resolution draft");
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Cómo se resolvió esta línea" }).value,
  ).toBe("ack_missing");
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Cómo se resolvió esta línea" }),
    "recover_dest",
  );
  expect(screen.getByLabelText("Nueva firma de recibido")).toBeDefined();
  hasChangedScope = false;
  api.setRoute("GET /api/v1/me/", () =>
    Response.json(inventoryMe({ permissions: ["discrepancy.read", "discrepancy.close"] })),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Motivo de la resolución" }))
      .value,
  ).toBe("Permitted private resolution draft");
  expect(screen.queryByLabelText("Nueva firma de recibido")).toBeNull();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Cómo se resolvió esta línea" }),
    "ack_missing",
  );
  expect(
    screen.getByRole<HTMLSelectElement>("combobox", { name: "Cómo se resolvió esta línea" }).value,
  ).toBe("ack_missing");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});
