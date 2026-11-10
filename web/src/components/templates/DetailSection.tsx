import { useId } from "react";
import type { ReactNode } from "react";
import { InfoHint } from "../../ui/InfoHint";

export interface DetailSectionProps {
  title: string;
  /** A hint that is really needed: shown as an (i) tooltip next to the title. */
  hint?: string;
  /** Small actions for this section only (right aligned). */
  actions?: ReactNode;
  children: ReactNode;
}

/** A card section of a detail page: title row, then content (usually a `DescriptionGrid`). */
export function DetailSection({ title, hint, actions, children }: DetailSectionProps) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="m-0 flex items-center gap-1 text-base leading-6 font-semibold">
          {title}
          {hint && <InfoHint text={hint} />}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
