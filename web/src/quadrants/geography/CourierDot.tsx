import { Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./geography.module.css";

/**
 * A courier on the map: icon plus name. A stale position is hollow and dashed, and its label
 * carries the age, so the state never depends on color.
 */
export function CourierDot({ label, isStale }: { label: string; isStale: boolean }) {
  return (
    <span className="pointer-events-none flex items-center gap-1" data-stale={isStale}>
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full border-2 border-action",
          isStale ? "border-dashed bg-surface text-action-strong" : "bg-action text-on-action",
        )}
      >
        <Bike aria-hidden="true" className="size-4" />
      </span>
      <span className={cn("text-xs font-semibold whitespace-nowrap text-ink", styles.labelHalo)}>
        {label}
      </span>
    </span>
  );
}
