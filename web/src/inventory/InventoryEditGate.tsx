import { useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { inventoryOptionOptions } from "./inventory-options";
import { useInventoryContext } from "./use-inventory-context";
import { InventoryDraftMemory } from "./use-inventory-draft";
import { InventoryForm } from "./InventoryForm";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import { inventoryRouteScope } from "./inventory-query";
interface Props {
  kind: InventoryKind;
  record: InventoryRecord;
  isVerifying: boolean;
  onSaved: (record: InventoryRecord) => void;
}
export function InventoryEditGate(props: Props) {
  if (props.kind === "supplies") return <InventoryForm {...props} />;
  return <ScopedEditor {...props} />;
}
function useEditorOptions(props: Props) {
  const request =
    props.kind === "lots"
      ? { kind: "placements" as const, lot: props.record.id }
      : { kind: "owners" as const, location: props.record.id };
  return useQuery(
    inventoryOptionOptions(
      inventoryRouteScope(useInventoryContext(), props.kind, props.record.code),
      request,
      { page: 1, search: "" },
    ),
  );
}
/** The action-specific read validates the exact saved pair before private draft rehydration. */
function ScopedEditor(props: Props) {
  const query = useEditorOptions(props);
  const memory = useContext(InventoryDraftMemory);
  useEffect(() => {
    if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
      memory.current = Object.fromEntries(
        Object.entries(memory.current).filter(
          ([key]) => key !== `${props.kind}:${props.record.id}`,
        ),
      );
  }, [query.error, memory, props.kind, props.record.id]);
  if (query.isPending || query.isPlaceholderData || !query.isFetchedAfterMount)
    return <CardSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <InventoryForm {...props} isVerifying={props.isVerifying || query.isFetching} />;
}
