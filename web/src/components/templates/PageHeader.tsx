import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Status pill(s) next to the title (Detail pages). */
  status?: ReactNode;
  /** Page actions, right aligned. One primary action per page. */
  actions?: ReactNode;
  /** Small line above the title: a human code or a "Paso X de N" label. */
  eyebrow?: ReactNode;
}

/** The one page header of every template: title, optional status, description and actions. */
export function PageHeader({ title, description, status, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {eyebrow && <p className="m-0 text-xs font-semibold text-ink-3">{eyebrow}</p>}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="m-0 min-w-0 text-2xl leading-8 font-bold tracking-tight text-ink [overflow-wrap:anywhere]">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <p className="m-0 max-w-[75ch] text-sm leading-5 text-ink-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
