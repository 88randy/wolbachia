import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyValue } from "../../ui/EmptyValue";

export interface DescriptionItem {
  /** Already translated label. */
  label: string;
  /** The value; `null`/`undefined`/"" renders a muted "—". Use `<EntityName>` for references. */
  value: ReactNode;
  /** Spans the whole row (long text such as notes). */
  wide?: boolean;
}

/** Label above, value below, normal font, in a 2 or 3 column grid that collapses on narrow screens. */
export function DescriptionGrid({
  items,
  columns = 3,
}: {
  items: readonly DescriptionItem[];
  columns?: 2 | 3;
}) {
  return (
    <dl
      className={cn(
        "m-0 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("flex min-w-0 flex-col gap-1", item.wide && "sm:col-span-full")}
        >
          <dt className="text-xs font-semibold text-ink-2">{item.label}</dt>
          <dd className="m-0 text-sm leading-5 text-ink [overflow-wrap:anywhere]">
            {item.value === null || item.value === undefined || item.value === "" ? (
              <EmptyValue />
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
