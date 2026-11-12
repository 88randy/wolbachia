import { useEffect, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { countPendingDeliveries } from "./pending-deliveries.ts";

/** How many deliveries wait for the courier; refreshes when the offline bundle changes. */
export function usePendingDeliveries(): number {
  const { supplyReceipt } = useServices();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let isActive = true;
    const load = () => {
      supplyReceipt
        .read()
        .then((state) => {
          if (isActive)
            setCount(
              countPendingDeliveries(
                state.assignments,
                state.shiftId,
                state.drafts.map((draft) => draft.releaseId),
              ),
            );
        })
        .catch(() => {
          if (isActive) setCount(0);
        });
    };
    load();
    const stop = supplyReceipt.subscribe(load);
    return () => {
      isActive = false;
      stop();
    };
  }, [supplyReceipt]);
  return count;
}
