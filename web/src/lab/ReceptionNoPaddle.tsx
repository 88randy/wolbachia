import { useTranslation } from "react-i18next";
import type { ReceptionActions } from "./use-reception-command";
import { ReceptionNoPaddleForm } from "./ReceptionNoPaddleForm";
import styles from "./reception.module.css";
export function ReceptionNoPaddle({ actions }: { actions: ReceptionActions }) {
  const { t } = useTranslation();
  return (
    <details className={styles.noPaddle}>
      <summary>{t("labReception.action.receiveNoPaddle")}</summary>
      <ReceptionNoPaddleForm actions={actions} />
    </details>
  );
}
