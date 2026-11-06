import { useTranslation } from "react-i18next";
import { useFormatDate } from "../format/use-formatters";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
export function NewVersionIntro({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  return (
    <>
      <p className={styles.hint}>{t("rules.form.hint")}</p>
      {parameter.next_change_at !== null && (
        <p className={styles.hint}>
          {t("rules.form.scheduledNote", { date: formatDate(parameter.next_change_at) })}
        </p>
      )}
    </>
  );
}
