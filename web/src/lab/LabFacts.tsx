import type { ReactNode } from "react";
import { EmptyValue } from "../ui/EmptyValue";

export interface LabFact {
  label: string;
  value: ReactNode;
}

/** Label above, value below, in two columns. Swap for the foundation DescriptionGrid when it lands. */
export function LabFacts({ items }: { items: readonly LabFact[] }) {
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs font-semibold text-ink-3">{item.label}</dt>
          <dd className="m-0 text-sm text-ink [overflow-wrap:anywhere]">
            {item.value ?? <EmptyValue />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
