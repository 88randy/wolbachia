import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { reportSessionError } from "../../session/session-events";
import { useQueryClient } from "@tanstack/react-query";
import { parseSupplierCode } from "../../scan/gs1";
import type { Gs1Data } from "../../scan/gs1";
import type { InventoryFieldsProps } from "../inventory-form-types";
import { readInventoryOptionPage } from "../inventory-options";
import { useInventoryContext } from "../use-inventory-context";
import { patchFromSupplierCode } from "./lot-scan-fill";
import type { FilledField } from "./lot-scan-fill";

export type FillResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "filled"; fields: FilledField[]; supplyLabel: string | null; hasGtin: boolean }
  | { kind: "unknown" }
  | { kind: "failed" };

/** Receiving: one scanned code fills the new-lot form, or opens the lot it names. */
export function useLotScanFill(form: InventoryFieldsProps) {
  const scope = useInventoryContext();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [result, setResult] = useState<FillResult>({ kind: "idle" });

  async function findSupply(gtin: string, signal: AbortSignal) {
    const page = await readInventoryOptionPage(
      scope,
      { request: { kind: "supplies" }, paging: { page: 1, search: gtin } },
      signal,
    );
    const supplies = page.results as readonly Schemas["Supply"][];
    return supplies.find((supply) => supply.gtin === gtin) ?? null;
  }

  async function fillFrom(data: Gs1Data, signal: AbortSignal) {
    const patch = patchFromSupplierCode(data);
    for (const [name, value] of Object.entries(patch.values)) form.setValue(name, value);
    const supply = data.gtin === null ? null : await findSupply(data.gtin, signal);
    if (supply) {
      form.setValue("supply_id", supply.id);
      form.setValue("supply_label", supply.label);
    }
    setResult({
      kind: "filled",
      fields: patch.fields,
      supplyLabel: supply?.label ?? null,
      hasGtin: data.gtin !== null,
    });
  }

  /** One of our own printed labels: its code is the human code of an existing lot. */
  async function openOwnLot(code: string, signal: AbortSignal) {
    const page = unwrap(
      await scope.client.GET("/api/v1/lots/", {
        params: { query: { code, page_size: 1 } },
        signal,
      }),
    );
    const lot = page.results.find((row) => row.code === code);
    if (!lot) return setResult({ kind: "unknown" });
    await navigate({ to: "/inventory/lots/$code", params: { code: lot.code } });
  }

  async function scan(raw: string) {
    const code = raw.trim();
    if (code === "") return;
    const guard = scope.beginWrite();
    setResult({ kind: "loading" });
    try {
      const data = parseSupplierCode(code);
      if (data) await fillFrom(data, guard.signal);
      else await openOwnLot(code, guard.signal);
    } catch (error) {
      if (guard.isStale()) return;
      setResult({ kind: "failed" });
      reportSessionError(error, cache);
    }
  }
  return { result, scan };
}
