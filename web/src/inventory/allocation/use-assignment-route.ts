import { useNavigate, useSearch } from "@tanstack/react-router";
import { todayIn } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function textParam(search: Record<string, unknown>, key: string) {
  const value = search[key];
  return typeof value === "string" ? value : "";
}

/** The day and courier live in the address bar, so a view can be shared and bookmarked. */
export function useAssignmentRoute() {
  const timeZone = useOrganizationTimeZone();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const requested = textParam(search, "date");
  const today = todayIn(timeZone);
  return {
    date: ISO_DAY.test(requested) ? requested : today,
    courierId: textParam(search, "courier"),
    setDate: (date: string) => {
      void navigate({ to: ".", search: { date } });
    },
  };
}
