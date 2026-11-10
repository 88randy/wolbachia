import type { ReactNode } from "react";
import type { TableController } from "../data-table/table-types";
import { CountScanStrip } from "./CountScanStrip";
import { RecentCounts } from "./RecentCounts";
import type { Candidate, LabScope } from "./lab-query";

interface CountWorkspaceLayoutProps {
  scope: LabScope;
  controller: TableController;
  select: (bag: Candidate) => void;
  hasBag: boolean;
  isLocked: boolean;
  children: ReactNode;
}

/** Main card (scan strip, bag, count) at 2/3 and the latest counts at 1/3. */
export function CountWorkspaceLayout(props: CountWorkspaceLayoutProps) {
  const { scope, controller, select, hasBag, isLocked, children } = props;
  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card lg:col-span-2">
        <fieldset disabled={isLocked} className="m-0 min-w-0 border-0 p-0">
          <CountScanStrip
            scope={scope}
            state={controller.state}
            focusFirst={!hasBag}
            onFound={select}
          />
        </fieldset>
        {children}
      </div>
      <RecentCounts scope={scope} />
    </div>
  );
}
