import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { inventoryScopedOptions } from "../inventory-read-context";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";
import type { Discrepancy } from "./discrepancy-query";

function useCorrectionLookup(state: DiscrepancyRecordState) {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState("");
  const options = inventoryScopedOptions(state.scope, {
    key: ["transfers", "correction", lookup],
    queryFn: async ({ signal }) =>
      unwrap(
        await state.scope.client.GET("/api/v1/transfers/", {
          params: { query: { code: lookup, page: 1 } },
          signal,
        }),
      ),
  });
  const query = useQuery({ ...options, enabled: options.enabled && !!lookup });
  const record =
    !query.isError && !query.isPlaceholderData
      ? query.data?.results.find((transfer) => transfer.code === lookup)
      : undefined;
  return { code, setCode, setLookup, query, record };
}
function correctionReceipts(
  candidate: Schemas["Transfer"] | undefined,
  source: Discrepancy | null,
) {
  if (!candidate || !source) return [];
  if (
    candidate.id === source.transfer_id ||
    candidate.destination_id !== source.transfer.destination_id
  )
    return [];
  return candidate.events.filter((event) => event.kind === "receive");
}
export function useDiscrepancyCorrection(
  state: DiscrepancyRecordState,
  line: Schemas["DiscrepancyLine"],
) {
  const lookup = useCorrectionLookup(state);
  const draft = state.draft.outcomes[line.id];
  const receipts = correctionReceipts(lookup.record, state.record);
  return {
    ...lookup,
    receipts,
    selectedReceipt: draft?.receiptId ?? "",
    isUnavailable: lookup.query.isFetched && !lookup.query.isFetching && receipts.length === 0,
    changeCode: (code: string) => {
      lookup.setCode(code);
      lookup.setLookup("");
      state.setOutcome(line.id, { kind: "reference_signed_correction" });
    },
    selectReceipt: (receiptId: string) => {
      state.setOutcome(line.id, {
        kind: "reference_signed_correction",
        correctionTransferId: lookup.record?.id,
        receiptId,
      });
    },
  };
}
export type DiscrepancyCorrectionModel = ReturnType<typeof useDiscrepancyCorrection>;
