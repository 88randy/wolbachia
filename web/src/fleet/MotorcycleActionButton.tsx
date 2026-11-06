import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Button } from "../ui/Button";
import styles from "./fleet.module.css";
interface Props {
  label: MessageKey;
  reason: MessageKey | undefined;
  onClick: () => void;
}
export function MotorcycleActionButton({ label, reason, onClick }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.content}>
      <Button
        variant="secondary"
        className={reason !== undefined ? styles.unavailable : undefined}
        aria-disabled={reason !== undefined}
        aria-describedby={reason === undefined ? undefined : id}
        onClick={() => {
          if (reason === undefined) onClick();
        }}
      >
        {t(label)}
      </Button>
      {reason !== undefined && (
        <p id={id} className={styles.hint}>
          {t(reason)}
        </p>
      )}
    </div>
  );
}
