import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
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
      <button
        type="button"
        className={classNames(
          buttons.button,
          buttons.secondary,
          reason !== undefined && styles.unavailable,
        )}
        aria-disabled={reason !== undefined}
        aria-describedby={reason === undefined ? undefined : id}
        onClick={() => {
          if (reason === undefined) onClick();
        }}
      >
        {t(label)}
      </button>
      {reason !== undefined && (
        <p id={id} className={styles.hint}>
          {t(reason)}
        </p>
      )}
    </div>
  );
}
