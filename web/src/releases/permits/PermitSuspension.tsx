import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { PermitNoticeTable } from "./PermitNoticeTable";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

interface Props {
  suspension: NonNullable<Permit["suspension"]>;
}

/**
 * Immutable suspension record plus the notice outcome, kept apart: the permit is suspended the
 * moment the server says so; whether anyone was reached is reported per kind and outcome.
 */
export function PermitSuspension({ suspension }: Props) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  return (
    <section aria-labelledby="permit-suspension" className={styles.panel}>
      <h2 id="permit-suspension" className={styles.panelTitle}>
        {t("permits.suspension.title")}
      </h2>
      <dl className={styles.facts}>
        <dt>{t("permits.suspension.since")}</dt>
        <dd>{formatDateTime(suspension.effective_from)}</dd>
        <dt>{t("permits.suspension.reason")}</dt>
        <dd>{suspension.reason}</dd>
      </dl>
      <h3 className={styles.panelTitle}>{t("permits.notice.title")}</h3>
      {suspension.notices.length === 0 ? (
        <p>{t("permits.notice.none")}</p>
      ) : (
        <PermitNoticeTable notices={suspension.notices} />
      )}
    </section>
  );
}
