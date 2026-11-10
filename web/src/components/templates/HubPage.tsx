import type { ReactNode } from "react";
import { useDocumentTitle } from "../../shell/use-document-title";
import { EmptyState } from "../../ui/EmptyState";
import { HubGrid } from "./HubGrid";
import type { HubCardItem } from "./HubCard";
import { PageFrame } from "./PageFrame";
import { PageHeader } from "./PageHeader";

/** Area home: a grid of icon cards with a short description (never a line of plain links). */
export function HubPage({
  title,
  description,
  items,
  children,
}: {
  title: string;
  description?: ReactNode;
  items: readonly HubCardItem[];
  children?: ReactNode;
}) {
  useDocumentTitle(title);
  return (
    <PageFrame>
      <PageHeader title={title} description={description} />
      {items.length > 0 ? <HubGrid items={items} label={title} /> : <EmptyState kind="noData" />}
      {children}
    </PageFrame>
  );
}
