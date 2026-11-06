import { Inbox, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import styles from "./ui.module.css";
interface EmptyStateProps {
  kind: "noData" | "noResults";
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
}
export function EmptyState({ kind, message, actionLabel, onAction, action }: EmptyStateProps) {
  const { t } = useTranslation();
  const Icon = kind === "noData" ? Inbox : ListFilter;
  const nextAction =
    action ??
    (onAction && (
      <Button variant="secondary" onClick={onAction}>
        {actionLabel ?? t(kind === "noData" ? "ui.actions.createFirst" : "ui.actions.clearFilters")}
      </Button>
    ));
  return (
    <div className={styles.state}>
      <Icon aria-hidden="true" strokeWidth={1.5} className={styles.stateIcon} />
      <p>{message ?? t(kind === "noData" ? "ui.states.noData" : "ui.states.noResults")}</p>
      {nextAction}
    </div>
  );
}
