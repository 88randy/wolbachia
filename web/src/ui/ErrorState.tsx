import { CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { StateFrame } from "./StateFrame";
import styles from "./ui.module.css";
interface ErrorStateProps {
  message?: string;
  code?: string;
  requestId?: string;
  onRetry: () => void;
}
export function ErrorState({ message, code, requestId, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <StateFrame
      role="alert"
      tone="critical"
      icon={CloudOff}
      message={message ?? t("ui.states.loadError")}
    >
      <Button variant="secondary" onClick={onRetry}>
        {t("common.actions.retry")}
      </Button>
      {(code !== undefined || requestId !== undefined) && (
        <details className={styles.details}>
          <summary>{t("ui.actions.details")}</summary>
          <dl>
            <dt>{t("ui.details.code")}</dt>
            <dd>{code}</dd>
            <dt>{t("ui.details.requestId")}</dt>
            <dd>{requestId}</dd>
          </dl>
        </details>
      )}
    </StateFrame>
  );
}
