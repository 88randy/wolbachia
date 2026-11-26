import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { todayIn } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";

declare module "@tanstack/history" {
  interface HistoryState {
    /** Courier chosen on the delivery screen (see `courierState`). */
    courier?: string;
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function textParam(search: Record<string, unknown>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value : "";
}

/**
 * The day lives in the address bar. The courier has no human code in the API, so it travels in
 * the history state (kept on reload and back/forward) and never as an id in the URL.
 */
export const courierState = (courier: string) => ({ courier });

export function useAssignmentRoute() {
  const timeZone = useOrganizationTimeZone();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const courierId = useLocation({ select: (location) => location.state.courier ?? "" });
  const requested = textParam(search, "date");
  const today = todayIn(timeZone);
  return {
    date: ISO_DAY.test(requested) ? requested : today,
    courierId,
    setDate: (date: string) => {
      void navigate({ to: ".", search: { date }, state: courierState(courierId) });
    },
  };
}
