import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useDocumentTitle } from "../../shell/use-document-title";
import { DetailCenter } from "./DetailCenter";
import { OverflowMenu } from "./OverflowMenu";
import type { OverflowAction } from "./OverflowMenu";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";

export interface DetailPageProps {
  title: string;
  /** Human code of the record (e.g. "I-0236"), shown above the title. */
  code?: ReactNode;
  /** `<StatusPill>` of the record: color + icon + text. */
  status?: ReactNode;
  /** One short line under the title (e.g. "Base Centro-Oriente · alta 10 nov 2026"). */
  subtitle?: ReactNode;
  /** Center of the record: a small center line next to the subtitle, only when the user sees several centers. */
  centerId?: string | null;
  /** @deprecated use `subtitle`. */
  description?: ReactNode;
  /** Back link above the header (the list this record belongs to). */
  back?: { label: string; link: Pick<LinkProps, "to" | "search" | "params"> };
  /** Compact button group, top right: the primary action and one or two secondary ones. */
  actions?: ReactNode;
  /** Rare actions (void, revoke, export…) in the "⋯" menu after `actions`. */
  moreActions?: readonly OverflowAction[];
  notices?: ReactNode;
  /** Main column: `DetailSection` cards with a `DescriptionGrid`, then tabs for history. */
  children: ReactNode;
  /** Optional right rail (timeline, related records). Stacks below on narrow screens. */
  aside?: ReactNode;
}

/** Template 2 of 4, Detail: header (title, status, subtitle, actions, ⋯), then card sections. */
export function DetailPage(props: DetailPageProps) {
  const { title, code, status, subtitle, description, back, actions, moreActions } = props;
  const { notices, children, aside, centerId } = props;
  const lead = subtitle ?? description;
  const headerLine = centerId ? (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {lead}
      <DetailCenter centerId={centerId} />
    </span>
  ) : (
    lead
  );
  useDocumentTitle(title);
  const headerActions =
    actions || moreActions?.length ? (
      <>
        {actions}
        {moreActions && <OverflowMenu actions={moreActions} />}
      </>
    ) : undefined;
  return (
    <PageFrame>
      {back && (
        <Link
          {...back.link}
          className="-mb-2 inline-flex w-max items-center gap-1.5 text-[13px] font-semibold text-action-strong hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      )}
      <PageHeader
        eyebrow={code}
        title={title}
        status={status}
        description={headerLine}
        actions={headerActions}
      />
      {notices}
      <div className={aside ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" : "contents"}>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
        {aside && <aside className="flex min-w-0 flex-col gap-5">{aside}</aside>}
      </div>
    </PageFrame>
  );
}
