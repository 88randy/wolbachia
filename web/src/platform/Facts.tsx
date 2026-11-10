import type { ReactNode } from "react";

export interface Fact {
  label: string;
  value: ReactNode;
}

/** Label above value, in a 2–3 column grid (normal font, never monospace). */
export function Facts({ items }: { items: readonly Fact[] }) {
  return (
    <dl className="m-0 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-semibold text-ink-2">{item.label}</dt>
          <dd className="m-0 text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
