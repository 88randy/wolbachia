import { Inbox, ListFilter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import styles from "./ui.module.css";
interface EmptyStateProps {
  kind: "noData" | "noResults";
  message?: string;
  actionLabel?: string;
  onAction: () => void;
}
export function EmptyState({ kind, message, actionLabel, onAction }: EmptyStateProps) {
  const { t } = useTranslation();
  const Icon = kind === "noData" ? Inbox : ListFilter;
  return (
    <div className={styles.state}>
      <Icon aria-hidden="true" strokeWidth={1.5} className={styles.stateIcon} />
      <p>{message ?? t(kind === "noData" ? "ui.states.noData" : "ui.states.noResults")}</p>
      <Button variant="secondary" onClick={onAction}>
        {actionLabel ?? t(kind === "noData" ? "ui.actions.createFirst" : "ui.actions.clearFilters")}
      </Button>
    </div>
  );
}
