import type { ReactNode } from "react";
import { useDocumentTitle } from "../../shell/use-document-title";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";

export interface ListPageProps {
  title: string;
  description?: ReactNode;
  /** The primary action (e.g. "Nuevo lote") and secondary ones. */
  actions?: ReactNode;
  /** Notices above the table (blocked actions, offline). */
  notices?: ReactNode;
  /**
   * The list itself: `<FilterBar controller={...} />` + `<DataTable ... />` from
   * `web/src/data-table`. Filters, sort and paging live in the URL and run on the server.
   */
  children: ReactNode;
}

/** Template 1 of 4, List: header, optional notices, then FilterBar + DataTable. */
export function ListPage({ title, description, actions, notices, children }: ListPageProps) {
  useDocumentTitle(title);
  return (
    <PageFrame>
      <PageHeader title={title} description={description} actions={actions} />
      {notices}
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </PageFrame>
  );
}
