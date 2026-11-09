import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { historyTable, HISTORY_PREFIX } from "./history-table";
interface Options {
  isPoint: boolean;
  userId: string;
  onClose?: () => void;
}
const URL_SCOPE = { prefix: HISTORY_PREFIX };
/** Histories own a complete namespace, independent of the parent list's filters/order/page. */
export function useHistoryController({ isPoint, userId, onClose }: Options) {
  const config = useMemo(() => historyTable(isPoint, userId), [isPoint, userId]);
  const controller = useTableUrlState(config, URL_SCOPE);
  const navigate = useNavigate();
  const close = () => {
    onClose?.();
    void navigate({
      to: ".",
      replace: true,
      search: (previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => !key.startsWith(HISTORY_PREFIX)),
        ),
    });
  };
  return { controller, close };
}
