import { MapPin } from "lucide-react";
import { EntityName } from "../../lookups/EntityName";
import { useShowCenter } from "../../lookups/use-center-scope";

/** Center of a record, shown only when the user sees several centers at once. */
export function DetailCenter({ centerId }: { centerId: string }) {
  const show = useShowCenter();
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <MapPin aria-hidden="true" className="size-3.5" />
      <EntityName kind="center" id={centerId} />
    </span>
  );
}
