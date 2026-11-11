import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { invalidateOrgScoped } from "../../../session/org-scoped-query";
import { reportSessionError } from "../../../session/session-events";
import { inventoryFailure } from "../../inventory-failure";
import type { InventoryFailure } from "../../inventory-failure";
import { useOrganizationTimeZone } from "../../../format/use-time-zone";
import { useInventoryContext } from "../../use-inventory-context";
import { draftBlockers, newFolio, newLine, prepareBody } from "./transfer-draft";
import type { DraftLine, TransferDraft } from "./transfer-draft";
import { useOriginStock } from "./use-origin-stock";

/** The draft shipment: from where, to where, which lots and how much. Saved only on submit. */
export function useNewTransfer() {
  const scope = useInventoryContext();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const timeZone = useOrganizationTimeZone();
  const folio = useRef(newFolio(timeZone));
  const [draft, setDraft] = useState<TransferDraft>({
    originId: "",
    destinationId: "",
    lines: [newLine()],
  });
  const [isBusy, setBusy] = useState(false);
  const [failure, setFailure] = useState<InventoryFailure>();
  const stock = useOriginStock(draft.originId);
  const blockers = draftBlockers(draft, stock.choices);
  const patch = (next: Partial<TransferDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };
  const setLine = (key: string, next: Partial<DraftLine>) => {
    patch({ lines: draft.lines.map((line) => (line.key === key ? { ...line, ...next } : line)) });
  };
  const submit = async () => {
    if (blockers.length > 0 || isBusy) return;
    const guard = scope.beginWrite();
    setBusy(true);
    setFailure(undefined);
    try {
      const body = prepareBody(folio.current, draft, stock.choices);
      unwrap(await scope.client.POST("/api/v1/transfers/", { body, signal: guard.signal }));
      void invalidateOrgScoped(cache, "transfers");
      void navigate({ to: "/inventory/transfers/$code", params: { code: folio.current } });
    } catch (error) {
      if (guard.isStale()) return;
      setFailure(inventoryFailure(error));
      reportSessionError(error, cache);
    } finally {
      setBusy(false);
    }
  };
  return {
    draft,
    stock,
    blockers,
    isBusy,
    failure,
    submit,
    setOrigin: (originId: string) => {
      patch({ originId, lines: [newLine()] });
    },
    setDestination: (destinationId: string) => {
      patch({ destinationId });
    },
    setLine,
    addLine: () => {
      patch({ lines: [...draft.lines, newLine()] });
    },
    removeLine: (key: string) => {
      const lines = draft.lines.filter((line) => line.key !== key);
      patch({ lines: lines.length > 0 ? lines : [newLine()] });
    },
  };
}
export type NewTransfer = ReturnType<typeof useNewTransfer>;
