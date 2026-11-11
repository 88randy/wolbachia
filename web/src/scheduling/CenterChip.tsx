import { MapPin } from "lucide-react";
import { EntityName } from "../lookups/EntityName";
import { useShowCenter } from "../lookups/use-center-scope";

/** A small chip with the center name; shown only while several centers are in view. */
export function CenterChip({ id }: { id: string | null | undefined }) {
  const show = useShowCenter();
  if (!show || !id) return null;
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-action-strong">
      <MapPin aria-hidden="true" className="size-3 flex-none" />
      <EntityName kind="center" id={id} />
    </span>
  );
}
