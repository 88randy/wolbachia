import { Inbox, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { StateFrame } from "./StateFrame";
interface EmptyStateProps {
  kind: "noData" | "noResults";
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}
export function EmptyState({ kind, message, actionLabel, onAction, action }: EmptyStateProps) {
  const { t } = useTranslation();
  const nextAction =
    action ??
    (onAction && (
      <Button variant="secondary" onClick={onAction}>
        {actionLabel ?? t(kind === "noData" ? "ui.actions.createFirst" : "ui.actions.clearFilters")}
      </Button>
    ));
  return (
    <StateFrame
      icon={kind === "noData" ? Inbox : ListFilter}
      message={message ?? t(kind === "noData" ? "ui.states.noData" : "ui.states.noResults")}
    >
      {nextAction}
    </StateFrame>
  );
}
