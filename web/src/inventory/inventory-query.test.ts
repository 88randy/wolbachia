import { describe, expect, test } from "vitest";
import { lotProtocolOf, protocolValuesOf } from "./inventory-protocol";
import { movementFiltersOf, placementQueryFor } from "./inventory-links";
import { inventoryLot, inventoryProtocol } from "../test/inventory-fixtures";
import { openInventory } from "../test/inventory-api";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatInventoryQuantity } from "./format-inventory-quantity";

describe("inventory contract mapping", () => {
  test("does not infer a lot protocol from its supply's configured protocol", () => {
    const lot = inventoryLot({ protocol_id: null });
    expect(lot.supply_version.protocol).not.toBeNull();
    expect(lotProtocolOf(lot)).toBeNull();
    expect(lotProtocolOf(inventoryLot())?.id).toBe(inventoryProtocol().id);
  });
  test("does not use an incompatible pin or unreadable protocol arrays", () => {
    expect(lotProtocolOf(inventoryLot({ protocol_id: "different-version" }))).toBeNull();
    expect(protocolValuesOf({ ...inventoryProtocol(), reading_windows: "unknown" })).toBeNull();
    expect(protocolValuesOf(inventoryProtocol())?.reading_windows).toEqual([
      [480, 540],
      [960, 1020],
    ]);
  });
  test("maps null pieces and actual operation IDs without confusing admission IDs", () => {
    expect(movementFiltersOf({ lot: "lot", piece_id: null, unit: "piece" })).toEqual({
      lot: "lot",
      piece: "none",
      unit: "piece",
    });
    expect(placementQueryFor({ kind: "lotUpdate", lot: "lot" })).toEqual({ lot: "lot" });
    expect(placementQueryFor({ kind: "lotCreate", center: "center" })).toEqual({
      action: "lot.create",
      center: "center",
    });
  });
});

test("URL expiry/blocker/order/page reach the server and remain on record/back links", async () => {
  const user = userEvent.setup();
  const { api } = await openInventory({
    path: "/inventory/lots?status=blocked&blocked_by=lot_expired&expiry_from_date=2026-11-01&expiry_before_date=2026-12-01&ordering=-expiry&page=2&unsupported=ignored",
  });
  const code = await screen.findByRole("link", { name: "LOT-01" });
  const request = api.requests.find((entry) => entry.path.startsWith("/api/v1/lots/?"));
  const params = new URL(request?.path ?? "", "https://test.invalid").searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    status: "blocked",
    blocked_by: "lot_expired",
    expiry_from_date: "2026-11-01",
    expiry_before_date: "2026-12-01",
    ordering: "-expiry",
    page: "2",
    page_size: "25",
  });
  expect(params.has("unsupported")).toBe(false);
  await user.click(code);
  const back = await screen.findByRole("link", { name: "Volver a la lista" });
  const retained = new URL(back.getAttribute("href") ?? "", "https://test.invalid").searchParams;
  expect(retained.get("blocked_by")).toBe("lot_expired");
  expect(retained.get("page")).toBe("2");
});
test("large signed ledger quantities preserve every fractional digit", () => {
  expect(formatInventoryQuantity("-9007199254740993.000001", "en")).toBe(
    "-9,007,199,254,740,993.000001",
  );
});
