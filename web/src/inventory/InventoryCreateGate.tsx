import { useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { InventoryForm } from "./InventoryForm";
import { InventoryDraftMemory } from "./use-inventory-draft";
import { useInventoryContext } from "./use-inventory-context";
import { creationTargetOf, inventoryCreationAccessOptions } from "./inventory-create-access";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
interface Props {
  kind: InventoryKind;
  onSaved: (record: InventoryRecord) => void;
}
export function InventoryCreateGate(props: Props) {
  if (props.kind === "supplies") return <InventoryForm {...props} />;
  return <ScopedCreation {...props} />;
}
function useCreationAccess(kind: InventoryKind) {
  const memory = useContext(InventoryDraftMemory);
  const key = kind + ":new";
  const [target] = useState(() => creationTargetOf(kind, memory.current[key]));
  const [ready, setReady] = useState(false);
  const query = useQuery(inventoryCreationAccessOptions(useInventoryContext(), target));
  useEffect(() => {
    if (ready) return;
    if (target && (!query.isFetchedAfterMount || query.isFetching || !query.isSuccess)) return;
    if (!target || query.data !== true)
      memory.current = Object.fromEntries(
        Object.entries(memory.current).filter(([candidate]) => candidate !== key),
      );
    setReady(true);
  }, [
    key,
    memory,
    target,
    ready,
    query.isFetchedAfterMount,
    query.isFetching,
    query.isSuccess,
    query.data,
  ]);
  return { ready, query };
}
/** An old create draft stays outside the DOM until its actual target is authorized now. */
function ScopedCreation(props: Props) {
  const { ready, query } = useCreationAccess(props.kind);
  if (ready) return <InventoryForm {...props} />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <CardSkeleton />;
}
