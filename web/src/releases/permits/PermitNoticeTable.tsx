import { useTranslation } from "react-i18next";
import { PermitNoticeRow } from "./PermitNoticeRow";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

type Notices = NonNullable<Permit["suspension"]>["notices"];

/** Notice outcome by kind of recipient (courier, coordinator) as a real table. */
export function PermitNoticeTable({ notices }: { notices: Notices }) {
  const { t } = useTranslation();
  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>{t("permits.notice.caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("permits.notice.kind")}</th>
          <th scope="col">{t("permits.notice.status")}</th>
          <th scope="col" className={styles.number}>
            {t("permits.notice.count")}
          </th>
        </tr>
      </thead>
      <tbody>
        {notices.map((notice) => (
          <PermitNoticeRow key={`${notice.kind}:${notice.status}`} notice={notice} />
        ))}
      </tbody>
    </table>
  );
}
