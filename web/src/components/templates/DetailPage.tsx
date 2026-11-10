import type { ReactNode } from "react";
import { useDocumentTitle } from "../../shell/use-document-title";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";

export interface DetailPageProps {
  title: string;
  /** Human code of the record (e.g. "I-0236"), shown above the title. */
  code?: ReactNode;
  /** `<StatusPill>` of the record: color + icon + text. */
  status?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  notices?: ReactNode;
  /** Main column: facts, history, related tables (use `ui/Card` sections). */
  children: ReactNode;
  /** Optional right rail (timeline, related records). Stacks below on narrow screens. */
  aside?: ReactNode;
}

/** Template 2 of 4, Detail: one record, its status, its actions and its sections. */
export function DetailPage(props: DetailPageProps) {
  const { title, code, status, description, actions, notices, children, aside } = props;
  useDocumentTitle(title);
  return (
    <PageFrame>
      <PageHeader
        eyebrow={code}
        title={title}
        status={status}
        description={description}
        actions={actions}
      />
      {notices}
      <div className={aside ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" : "contents"}>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
        {aside && <aside className="flex min-w-0 flex-col gap-5">{aside}</aside>}
      </div>
    </PageFrame>
  );
}
