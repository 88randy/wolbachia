import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { expect, test, vi } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { openInventory } from "../../test/inventory-api";
import { inventoryPage } from "../../test/inventory-fixtures";
import {
  BAG_ID,
  INTENT_ID,
  RPBI_ID,
  allocationMe,
  biologicalLot,
  plainLot,
  reasonRoutes,
} from "./allocation-fixtures";

// B-04 byte and verification rules are owned by transfer-evidence.test.ts; this suite owns wiring.
vi.mock("../transfers/TransferEvidence", () => ({
  TransferEvidence: ({
    label,
    onVerified,
  }: {
    label: string;
    onVerified: (id: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onVerified("10700000-0000-4000-8000-000000000006");
      }}
    >
      {label}
    </button>
  ),
}));

const BAG = {
  id: BAG_ID,
  code: "B-4471",
  lab: { revision: 4, status: "counted", receipt_id: null, count_id: null, rejection_id: null },
} as unknown as Schemas["Bag"];

function writeRoutes(extra: Record<string, Response> = {}) {
  return {
    ...reasonRoutes(),
    "GET /api/v1/write-offs/": Response.json(inventoryPage([])),
    "GET /api/v1/bags/": Response.json(inventoryPage([BAG])),
    "POST /api/v1/inventory-intents/": Response.json(
      {
        intent: {
          id: INTENT_ID,
          kind: "bag_disposal",
          expected_revision: 4,
          input_hash: "h",
          evidence: [],
        },
      },
      { status: 201 },
    ),
    ...extra,
  };
}

async function chooseReason(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByRole("combobox", { name: "Motivo" }), "duplicate");
}

test("W39 bag disposal is blocked without a verified RPBI and sends it once verified", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/lab/write-offs",
    me: allocationMe(["bag.dispose"]),
    routes: writeRoutes({
      "POST /api/v1/write-offs/": Response.json(
        { write_off: { kind: "bag", id: INTENT_ID, bag_id: BAG_ID } },
        { status: 201 },
      ),
    }),
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  await user.click(await screen.findByRole("button", { name: "Registrar una baja" }));
  await user.type(
    await screen.findByRole("textbox", { name: "Código del lote o la bolsa" }),
    "B-4471{Enter}",
  );
  await screen.findByText("B-4471");
  await chooseReason(user);
  const submit = screen.getByRole("button", { name: "Dar de baja" });
  await user.click(submit);
  expect(submit.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getAllByText(/Falta el comprobante RPBI verificado/).length).toBeGreaterThan(0);
  expect(api.requests.some((request) => request.path.includes("/inventory-intents/"))).toBe(false);

  await user.click(screen.getByRole("button", { name: /Comprobante de manejo/ }));
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Dar de baja" }).getAttribute("aria-disabled"),
    ).toBeNull();
  });
  await user.click(screen.getByRole("button", { name: "Dar de baja" }));
  expect(await screen.findByText("Baja registrada.")).toBeDefined();
  const prepare = api.requests.find((request) => request.path.includes("/inventory-intents/"));
  expect(prepare?.body).toMatchObject({
    kind: "bag_disposal",
    bag_id: BAG_ID,
    expected_revision: 4,
    evidence: [{ role: "rpbi", upload_id: RPBI_ID }],
  });
});

test("the warehouse entry applies the same rule to a biological lot and not to a plain one", async () => {
  const user = userEvent.setup();
  let lot = biologicalLot();
  await openInventory({
    path: "/inventory/write-offs",
    me: allocationMe(["inventory.write_off"]),
    routes: {
      ...writeRoutes(),
      "GET /api/v1/lots/": () => Response.json(inventoryPage([lot])),
    },
  });
  async function fill() {
    await user.click(await screen.findByRole("button", { name: "Registrar una baja" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Código del lote o la bolsa" }),
      "LOT-01{Enter}",
    );
    await user.type(await screen.findByRole("textbox", { name: "Cantidad" }), "3");
    await chooseReason(user);
    await user.click(screen.getByRole("button", { name: "Dar de baja" }));
  }
  await fill();
  expect(screen.getByRole("button", { name: "Dar de baja" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  expect(screen.getAllByText(/Falta el comprobante RPBI verificado/).length).toBeGreaterThan(0);
  expect(plainLot().supply_version.is_biological).toBe(false);
  lot = plainLot();
});

test("an unknown and a foreign code are indistinguishable", async () => {
  const user = userEvent.setup();
  await openInventory({
    path: "/inventory/write-offs",
    me: allocationMe(["inventory.write_off"]),
    routes: { ...writeRoutes(), "GET /api/v1/lots/": Response.json(inventoryPage([])) },
  });
  await user.click(await screen.findByRole("button", { name: "Registrar una baja" }));
  const code = await screen.findByRole("textbox", { name: "Código del lote o la bolsa" });
  await user.type(code, "NOPE{Enter}");
  const first = await screen.findByText("No se encontró ese código en tu alcance.");
  expect(first).toBeDefined();
  await user.clear(code);
  await user.type(code, "FOREIGN-1{Enter}");
  expect(await screen.findByText("No se encontró ese código en tu alcance.")).toBeDefined();
});

test.each(["es-MX", "en"] as const)(
  "the write-off form has no axe violations in %s",
  async (language) => {
    const user = userEvent.setup();
    await openInventory({
      path: "/lab/write-offs",
      me: allocationMe(["bag.dispose"]),
      routes: writeRoutes(),
      language,
    });
    await user.click(
      await screen.findByRole("button", {
        name: /Registrar una baja|Record a write-off/,
      }),
    );
    await screen.findByRole("dialog");
    expect(await axe(document.body)).toHaveNoViolations();
  },
);
