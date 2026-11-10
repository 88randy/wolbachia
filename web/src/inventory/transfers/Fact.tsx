import type { ReactNode } from "react";

/** One cell of a description grid: label above, value below. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="m-0 mt-1 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** Two or three column description grid. */
export function FactGrid({ children }: { children: ReactNode }) {
  return <dl className="m-0 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>;
}
